import { discoverDependencies } from '../telemetry/data-generators.js';
import { queryGemini } from '../../integrations/gemini/gemini.client.js';
import type { InvestigationContext, DependencyFindings, TelemetryFindings, EventEmitter } from '../types.js';

/**
 * Dependency Agent (part of Root Cause)
 * Discovers service dependencies from trace data and identifies cascade impacts.
 */
export async function discoverServiceDependencies(
  context: InvestigationContext,
  telemetry: TelemetryFindings,
  emit: EventEmitter
): Promise<DependencyFindings> {
  emit({ agent: 'root-cause', status: 'running', message: 'Discovering service dependencies from trace data...', timestamp: new Date().toISOString() });

  const dependencies = discoverDependencies(context.serviceName);

  // Identify impacted services from traces
  const erroredServices = new Set(
    telemetry.traces
      .filter(t => t.status === 'ERROR')
      .map(t => t.serviceName)
  );

  const impactedServices = [...erroredServices];

  emit({ agent: 'root-cause', status: 'running', message: `Discovered ${dependencies.length} dependencies, ${impactedServices.length} services impacted`, timestamp: new Date().toISOString() });

  // Use Gemini to assess cascade risk
  const cascadePrompt = `Service dependency analysis for incident in "${context.serviceName}":
Dependencies: ${dependencies.map(d => `${d.source} → ${d.target} (${d.protocol}, err: ${(d.errorRate * 100).toFixed(2)}%, lat: ${d.avgLatencyMs}ms)`).join('; ')}
Impacted services: ${impactedServices.join(', ')}

Assess the cascade risk. Respond with JSON:
{"cascadeRisk": "low"|"medium"|"high", "topology": "<brief description of how failure propagates>"}`;

  let cascadeRisk: 'low' | 'medium' | 'high' = 'medium';
  let topology = '';

  try {
    const response = await queryGemini(cascadePrompt);
    const parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    cascadeRisk = parsed.cascadeRisk ?? 'medium';
    topology = parsed.topology ?? '';
  } catch {
    cascadeRisk = impactedServices.length > 2 ? 'high' : 'medium';
    topology = `${context.serviceName} failure propagates to ${impactedServices.filter(s => s !== context.serviceName).join(', ')} via ${dependencies[0]?.protocol ?? 'gRPC'} calls. Elevated error rates suggest cascade in progress.`;
  }

  return { dependencies, impactedServices, cascadeRisk, topology };
}
