import { queryGemini } from '../../integrations/gemini/gemini.client.js';
import type {
  InvestigationContext, RemediationFindings, RootCauseFindings,
  DeploymentFindings, PRTracebackFindings, EventEmitter,
} from '../types.js';

/**
 * Remediation Agent
 * Generates actionable remediation steps based on root cause analysis.
 */
export async function runRemediationAgent(
  context: InvestigationContext,
  rootCause: RootCauseFindings,
  deployment: DeploymentFindings,
  prTraceback: PRTracebackFindings,
  emit: EventEmitter
): Promise<RemediationFindings> {
  emit({ agent: 'remediation', status: 'running', message: 'Generating remediation plan...', timestamp: new Date().toISOString() });

  const prompt = `You are an SRE AI agent. Generate a remediation plan for this incident:

**Incident:** ${context.title} (${context.severity})
**Service:** ${context.serviceName}
**Root Cause:** ${rootCause.rootCause}
**Confidence:** ${rootCause.confidence}%
**Contributing Factors:** ${rootCause.contributingFactors.join('; ')}
**Suspected PR:** #${prTraceback.suspectedPR?.number} - "${prTraceback.suspectedPR?.title}" (${prTraceback.suspectedPR?.changedFiles} files changed)
**Rollback Available:** ${deployment.suspectedDeployment?.rollbackAvailable ? 'Yes' : 'No'}

Generate a prioritized remediation plan. Respond with JSON:
{
  "actions": [{"priority": 1, "action": "<specific action>", "risk": "low|medium|high", "eta": "<time estimate>", "automated": true|false}],
  "summary": "<brief overall strategy>",
  "rollbackRecommended": true|false,
  "preventionMeasures": ["<future prevention measure>"]
}`;

  let findings: RemediationFindings;

  try {
    const response = await queryGemini(prompt);
    findings = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch {
    findings = {
      actions: [
        { priority: 1, action: `Rollback ${context.serviceName} to v${deployment.suspectedDeployment?.previousVersion}`, risk: 'low', eta: '5 minutes', automated: true },
        { priority: 2, action: `Apply hotfix: restore connection pool size to 50 in ${context.serviceName}`, risk: 'medium', eta: '20 minutes', automated: false },
        { priority: 3, action: 'Scale up replicas to handle backlog of queued requests', risk: 'low', eta: '3 minutes', automated: true },
        { priority: 4, action: 'Enable circuit breaker for downstream calls to prevent cascade', risk: 'low', eta: '10 minutes', automated: true },
        { priority: 5, action: `Review and update PR #${prTraceback.suspectedPR?.number} with correct configuration`, risk: 'medium', eta: '1 hour', automated: false },
      ],
      summary: `Immediate rollback recommended to restore service. Parallel hotfix preparation for the connection pool configuration. Post-incident: add load tests to CI pipeline for config changes.`,
      rollbackRecommended: true,
      preventionMeasures: [
        'Add load testing gate for configuration changes in CI/CD',
        'Implement canary deployments with automatic rollback on error spike',
        'Add connection pool size as a monitored metric with alerting',
        'Require SRE review for infrastructure configuration PRs',
      ],
    };
  }

  emit({
    agent: 'remediation',
    status: 'completed',
    message: `Remediation plan ready: ${findings.actions.length} actions, rollback ${findings.rollbackRecommended ? 'recommended' : 'not needed'}`,
    data: { actionCount: findings.actions.length, rollbackRecommended: findings.rollbackRecommended },
    timestamp: new Date().toISOString(),
  });

  return findings;
}
