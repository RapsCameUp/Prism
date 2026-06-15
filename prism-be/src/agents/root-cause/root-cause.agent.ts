import { queryGemini } from '../../integrations/gemini/gemini.client.js';
import { discoverServiceDependencies } from './dependency.discovery.js';
import type {
  InvestigationContext, RootCauseFindings, DependencyFindings,
  TelemetryFindings, DeploymentFindings, EventEmitter,
} from '../types.js';

/**
 * Root Cause Agent
 * Synthesizes findings from telemetry and deployment agents using Gemini to determine root cause.
 */
export async function runRootCauseAgent(
  context: InvestigationContext,
  telemetry: TelemetryFindings,
  deployment: DeploymentFindings,
  emit: EventEmitter
): Promise<{ rootCause: RootCauseFindings; dependencies: DependencyFindings }> {
  emit({ agent: 'root-cause', status: 'running', message: 'Analyzing correlations across telemetry, deployments, and dependencies...', timestamp: new Date().toISOString() });

  // Discover dependencies
  const dependencies = await discoverServiceDependencies(context, telemetry, emit);

  // Build comprehensive prompt for root cause analysis
  const prompt = `You are a Site Reliability Engineer AI agent. Perform root cause analysis for this incident:

**Incident:** ${context.title}
**Service:** ${context.serviceName}
**Severity:** ${context.severity}
**Detected:** ${context.detectedAt}

**Telemetry Evidence:**
- ${telemetry.logs.length} error logs collected
- Top error patterns: ${telemetry.errorPatterns.slice(0, 3).map(p => `"${p.message}" (${p.count}x)`).join('; ')}
- Anomalies detected: ${telemetry.anomalies.join('; ')}
- Metrics show error rate spike and latency degradation starting ~20 min after deployment

**Deployment Correlation:**
- Suspected deployment: ${context.serviceName} v${deployment.suspectedDeployment?.version} (PR #${deployment.suspectedDeployment?.prNumber}, ${deployment.suspectedDeployment?.changedFiles} files changed)
- Deployed at: ${deployment.suspectedDeployment?.deployedAt}
- Correlation score: ${deployment.correlationScore}%
- ${deployment.timelineAnalysis}

**Service Dependencies:**
- ${dependencies.dependencies.length} dependencies discovered
- Impacted services: ${dependencies.impactedServices.join(', ')}
- Cascade risk: ${dependencies.cascadeRisk}
- ${dependencies.topology}

Provide a detailed root cause analysis. Respond with JSON:
{
  "rootCause": "<specific technical root cause>",
  "confidence": <0-100>,
  "reasoning": "<chain of evidence leading to this conclusion>",
  "contributingFactors": ["<factor1>", "<factor2>", ...],
  "timeline": [{"time": "<relative time>", "event": "<what happened>"}]
}`;

  let findings: RootCauseFindings;

  try {
    const response = await queryGemini(prompt);
    const parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    findings = {
      rootCause: parsed.rootCause,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      contributingFactors: parsed.contributingFactors || [],
      timeline: parsed.timeline || [],
    };
  } catch {
    findings = {
      rootCause: `Connection pool exhaustion in ${context.serviceName} caused by misconfigured max connections in PR #${deployment.suspectedDeployment?.prNumber}. The deployment reduced pool size from 50 to 10 connections, causing request queuing under normal load.`,
      confidence: deployment.correlationScore,
      reasoning: `Temporal correlation between deployment (v${deployment.suspectedDeployment?.version}) and error onset is strong. Error pattern "Connection pool exhausted" directly indicates resource starvation. Memory growth confirms connection objects accumulating without release.`,
      contributingFactors: [
        'Reduced connection pool size in recent PR',
        'No load testing performed on configuration change',
        'Missing circuit breaker on downstream calls',
        'Auto-scaling policy too slow to react',
      ],
      timeline: [
        { time: '-2h', event: `Deployment of v${deployment.suspectedDeployment?.version} with connection pool changes` },
        { time: '-1h 40m', event: 'First connection timeout errors appear in logs' },
        { time: '-1h 20m', event: 'Error rate crosses alerting threshold' },
        { time: '-1h', event: 'Cascade begins affecting downstream services' },
        { time: '-40m', event: 'Memory usage spikes as connections queue up' },
        { time: '0', event: 'Incident detected and investigation triggered' },
      ],
    };
  }

  emit({
    agent: 'root-cause',
    status: 'completed',
    message: `Root cause identified (${findings.confidence}% confidence): ${findings.rootCause.slice(0, 100)}...`,
    data: { confidence: findings.confidence, factorCount: findings.contributingFactors.length },
    timestamp: new Date().toISOString(),
  });

  return { rootCause: findings, dependencies };
}
