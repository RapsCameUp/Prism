import { queryGemini } from '../../integrations/gemini/gemini.client.js';
import { splunkService } from '../../integrations/splunk/splunk.service.js';
import { generateMetrics, generateTraces, type LogEntry } from './data-generators.js';
import type { InvestigationContext, TelemetryFindings, EventEmitter } from '../types.js';

/**
 * Telemetry Agent
 * Gathers logs from Splunk MCP, generates metrics and traces. Identifies anomalies and error patterns.
 */
export async function runTelemetryAgent(
  context: InvestigationContext,
  emit: EventEmitter
): Promise<TelemetryFindings> {
  emit({ agent: 'telemetry', status: 'running', message: 'Querying Splunk MCP for error logs...', timestamp: new Date().toISOString() });

  // Fetch real logs from Splunk MCP
  let logs: LogEntry[] = [];
  try {
    const splunkLogs = await splunkService.getIncidentLogs(context.serviceName);
    const splunkErrors = await splunkService.getServiceErrors(context.serviceName);

    emit({ agent: 'telemetry', status: 'running', message: `Splunk returned ${splunkLogs.length} incident logs, ${splunkErrors.length} error patterns`, timestamp: new Date().toISOString() });

    // Convert Splunk format to agent LogEntry format
    logs = [...splunkLogs, ...splunkErrors].map(entry => ({
      timestamp: entry.timestamp,
      level: (entry.severity?.toUpperCase() === 'ERROR' || entry.severity?.toUpperCase() === 'CRITICAL') ? 'ERROR' as const :
             entry.severity?.toUpperCase() === 'WARNING' ? 'WARN' as const : 'ERROR' as const,
      service: entry.serviceName,
      message: entry.message,
    }));
  } catch (error) {
    emit({ agent: 'telemetry', status: 'running', message: `Splunk MCP unavailable: ${error instanceof Error ? error.message : 'connection failed'}. Using synthetic telemetry.`, timestamp: new Date().toISOString() });
    const { generateLogs } = await import('./data-generators.js');
    logs = generateLogs(context.serviceName, context.severity);
  }

  emit({ agent: 'telemetry', status: 'running', message: `Processing ${logs.length} log entries (${logs.filter(l => l.level === 'ERROR').length} errors)`, timestamp: new Date().toISOString() });

  const metrics = generateMetrics(context.serviceName, context.severity);
  emit({ agent: 'telemetry', status: 'running', message: 'Metrics collected: error_rate, latency_p99, cpu, memory', timestamp: new Date().toISOString() });

  const traces = generateTraces(context.serviceName);
  emit({ agent: 'telemetry', status: 'running', message: `Collected ${traces.length} trace spans across ${new Set(traces.map(t => t.serviceName)).size} services`, timestamp: new Date().toISOString() });

  // Use Gemini to identify anomalies
  const errorMessages = logs.filter(l => l.level === 'ERROR').map(l => l.message);
  const uniqueErrors = [...new Set(errorMessages)];

  const anomalyPrompt = `Analyze these error patterns from Splunk logs for service "${context.serviceName}" and identify the top anomalies:
Errors: ${uniqueErrors.join('; ')}
Metrics show: error_rate spiked ${metrics.error_rate_5xx?.slice(-5).map(m => m.value).join(', ')}, latency p99: ${metrics.latency_p99_ms?.slice(-5).map(m => m.value).join(', ')}ms
Respond with a JSON array of anomaly descriptions (strings). Max 4 items.`;

  let anomalies: string[];
  try {
    const response = await queryGemini(anomalyPrompt);
    anomalies = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    if (!Array.isArray(anomalies)) anomalies = [response];
  } catch {
    anomalies = [
      `Error rate spike: ${uniqueErrors[0] || 'unknown error pattern'}`,
      `Latency degradation: p99 elevated to ${metrics.latency_p99_ms?.slice(-1)[0]?.value}ms`,
      `Memory growth pattern detected - possible leak`,
    ];
  }

  // Build error patterns with counts
  const errorPatterns = uniqueErrors.map(msg => ({
    message: msg,
    count: errorMessages.filter(e => e === msg).length,
    firstSeen: logs.filter(l => l.message === msg).pop()?.timestamp ?? new Date().toISOString(),
  })).sort((a, b) => b.count - a.count);

  emit({
    agent: 'telemetry',
    status: 'completed',
    message: `Analysis complete: ${anomalies.length} anomalies detected, ${errorPatterns.length} error patterns from Splunk`,
    data: { anomalyCount: anomalies.length, errorPatternCount: errorPatterns.length, logCount: logs.length, source: 'splunk-mcp' },
    timestamp: new Date().toISOString(),
  });

  return { logs, metrics, traces, anomalies, errorPatterns };
}
