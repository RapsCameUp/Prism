import { prisma } from '../../utils/prisma.js';
import { githubService } from '../../integrations/github/github.service.js';
import { splunkService } from '../../integrations/splunk/splunk.service.js';
import { runTelemetryAgent } from '../telemetry/telemetry.agent.js';
import { runDeploymentAgent } from '../deployment/deployment.agent.js';
import { runRootCauseAgent } from '../root-cause/root-cause.agent.js';
import { runPRTracebackAgent } from '../pr-traceback/pr-traceback.agent.js';
import { runRemediationAgent } from '../remediation/remediation.agent.js';
import type { InvestigationContext, FullInvestigationResult, AgentEvent, EventEmitter } from '../types.js';

/**
 * Incident Coordinator Agent
 * Orchestrates all other agents in sequence, aggregates findings, and produces the final investigation report.
 */
export async function runCoordinatorAgent(
  incidentId: string,
  emit: EventEmitter
): Promise<FullInvestigationResult> {
  emit({ agent: 'coordinator', status: 'running', message: 'Investigation initiated. Loading incident details...', timestamp: new Date().toISOString() });

  // Load incident — check DB first, then Splunk
  let incident: { id: string; title: string; description: string; severity: string; serviceName: string; detectedAt: Date | string } | null = null;

  if (incidentId.match(/^[0-9a-fA-F]{24}$/)) {
    incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  }

  if (!incident) {
    const splunkIncident = await splunkService.getIncidentById(incidentId);
    if (splunkIncident) {
      incident = {
        id: splunkIncident.id,
        title: splunkIncident.title,
        description: splunkIncident.description,
        severity: splunkIncident.severity,
        serviceName: splunkIncident.serviceName,
        detectedAt: splunkIncident.detectedAt,
      };
    }
  }

  if (!incident) throw new Error('Incident not found');

  const context: InvestigationContext = {
    incidentId,
    serviceName: incident.serviceName,
    severity: incident.severity,
    title: incident.title,
    description: incident.description,
    detectedAt: typeof incident.detectedAt === 'string' ? incident.detectedAt : incident.detectedAt.toISOString(),
  };

  emit({ agent: 'coordinator', status: 'running', message: `Investigating: "${context.title}" in ${context.serviceName} (${context.severity})`, timestamp: new Date().toISOString() });

  // Phase 1: Telemetry Agent (logs, metrics, traces)
  emit({ agent: 'coordinator', status: 'running', message: 'Phase 1/5: Dispatching Telemetry Agent...', timestamp: new Date().toISOString() });
  const telemetry = await runTelemetryAgent(context, emit);

  // Phase 2: Deployment Agent (correlate with deployments)
  emit({ agent: 'coordinator', status: 'running', message: 'Phase 2/5: Dispatching Deployment Agent...', timestamp: new Date().toISOString() });
  const deployment = await runDeploymentAgent(context, telemetry, emit);

  // Phase 3: Root Cause Agent (synthesize + dependency discovery)
  emit({ agent: 'coordinator', status: 'running', message: 'Phase 3/5: Dispatching Root Cause Agent...', timestamp: new Date().toISOString() });
  const { rootCause, dependencies } = await runRootCauseAgent(context, telemetry, deployment, emit);

  // Phase 4: PR Traceback Agent
  emit({ agent: 'coordinator', status: 'running', message: 'Phase 4/5: Dispatching PR Traceback Agent...', timestamp: new Date().toISOString() });
  const prTraceback = await runPRTracebackAgent(context, deployment, rootCause, emit);

  // Phase 5: Remediation Agent
  emit({ agent: 'coordinator', status: 'running', message: 'Phase 5/5: Dispatching Remediation Agent...', timestamp: new Date().toISOString() });
  const remediation = await runRemediationAgent(context, rootCause, deployment, prTraceback, emit);

  // Calculate overall confidence
  const overallConfidence = Math.round(
    (rootCause.confidence * 0.4) +
    (deployment.correlationScore * 0.3) +
    ((prTraceback.suspectedPR?.riskScore ?? 50) * 0.3)
  );

  // Build summary
  const summary = [
    `Investigation of "${context.title}" in ${context.serviceName} complete.`,
    `Root cause: ${rootCause.rootCause}`,
    `Confidence: ${overallConfidence}%.`,
    prTraceback.suspectedPR ? `Suspected PR: #${prTraceback.suspectedPR.number} by ${prTraceback.suspectedPR.author}.` : '',
    `${remediation.actions.length} remediation actions recommended.`,
    remediation.rollbackRecommended ? 'Immediate rollback recommended.' : '',
  ].filter(Boolean).join(' ');

  // Store investigation in DB
  const metadata = {
    telemetrySummary: {
      logCount: telemetry.logs.length,
      errorPatterns: telemetry.errorPatterns,
      anomalies: telemetry.anomalies,
      traceCount: telemetry.traces.length,
    },
    deployment: {
      suspectedDeployment: deployment.suspectedDeployment ? {
        version: deployment.suspectedDeployment.version,
        deployedAt: deployment.suspectedDeployment.deployedAt,
        deployedBy: deployment.suspectedDeployment.deployedBy,
        changedFiles: deployment.suspectedDeployment.changedFiles,
        prNumber: deployment.suspectedDeployment.prNumber,
      } : null,
      correlationScore: deployment.correlationScore,
      timelineAnalysis: deployment.timelineAnalysis,
    },
    rootCauseDetails: {
      reasoning: rootCause.reasoning,
      contributingFactors: rootCause.contributingFactors,
      timeline: rootCause.timeline,
    },
    dependencies: {
      impactedServices: dependencies.impactedServices,
      cascadeRisk: dependencies.cascadeRisk,
    },
    remediation: {
      actions: remediation.actions,
      rollbackRecommended: remediation.rollbackRecommended,
      preventionMeasures: remediation.preventionMeasures,
    },
    prTraceback: {
      suspectedPR: prTraceback.suspectedPR,
      commitAnalysis: prTraceback.commitAnalysis,
      relatedPRs: prTraceback.relatedPRs,
      diff: '',
      changedFileNames: [] as string[],
    },
  };

  // Fetch PR diff if we have a suspected PR
  if (prTraceback.suspectedPR) {
    try {
      const repo = await prisma.repository.findFirst({ where: { serviceName: context.serviceName } });
      if (repo) {
        const match = repo.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          const prOwner = match[1];
          const prRepoName = match[2].replace(/\.git$/, '');
          const files = await githubService.getPullRequestDiff(prOwner, prRepoName, prTraceback.suspectedPR.number);
          if (files.length > 0) {
            metadata.prTraceback.changedFileNames = files.map(f => f.filename);
            // Combine patches (limited to first 3 files, max 2000 chars)
            const combinedDiff = files
              .filter(f => f.patch)
              .slice(0, 3)
              .map(f => `--- ${f.filename}\n${f.patch}`)
              .join('\n\n')
              .slice(0, 2000);
            metadata.prTraceback.diff = combinedDiff;
          }
        }
      }
    } catch {
      // Non-critical: diff fetch failed
    }
  }

  await prisma.investigation.create({
    data: {
      incidentId,
      summary,
      rootCause: rootCause.rootCause,
      suspectedPrNumber: prTraceback.suspectedPR?.number ?? null,
      suspectedPrUrl: prTraceback.suspectedPR?.url ?? null,
      confidenceScore: overallConfidence,
      metadata,
    },
  });

  // Update incident status (only for DB-stored incidents)
  const isDbIncident = incidentId.match(/^[0-9a-fA-F]{24}$/);
  if (isDbIncident) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'investigating', confidenceScore: overallConfidence },
    });
  }

  // Auto-create GitHub issue for critical incidents
  let githubIssueUrl: string | undefined;
  if (incident.severity === 'critical') {
    githubIssueUrl = await createCriticalIncidentIssue(context, rootCause, prTraceback, deployment, remediation, dependencies, telemetry);
    if (githubIssueUrl && isDbIncident) {
      await prisma.incident.update({
        where: { id: incidentId },
        data: { githubIssueUrl },
      });
    }
  }

  emit({
    agent: 'coordinator',
    status: 'completed',
    message: `Investigation complete. Overall confidence: ${overallConfidence}%. ${remediation.actions.length} remediation actions ready.`,
    data: { overallConfidence, summary },
    timestamp: new Date().toISOString(),
  });

  return {
    context,
    telemetry,
    deployment,
    dependencies,
    prTraceback,
    rootCause,
    remediation,
    overallConfidence,
    summary,
    githubIssueUrl,
  };
}

async function createCriticalIncidentIssue(
  context: InvestigationContext,
  rootCause: import('../types.js').RootCauseFindings,
  prTraceback: import('../types.js').PRTracebackFindings,
  deployment: import('../types.js').DeploymentFindings,
  remediation: import('../types.js').RemediationFindings,
  dependencies: import('../types.js').DependencyFindings,
  telemetry: import('../types.js').TelemetryFindings,
): Promise<string | undefined> {
  try {
    const repo = await prisma.repository.findFirst({ where: { serviceName: context.serviceName } });
    if (!repo) return undefined;

    const match = repo.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return undefined;
    const owner = match[1];
    const repoName = match[2].replace(/\.git$/, '');

    const issueBody = [
      `## 🚨 Critical Incident: ${context.title}`,
      '',
      '| Field | Value |',
      '|-------|-------|',
      `| **Severity** | Critical |`,
      `| **Service** | ${context.serviceName} |`,
      `| **Detected** | ${context.detectedAt} |`,
      `| **Confidence** | ${rootCause.confidence}% |`,
      `| **Cascade Risk** | ${dependencies.cascadeRisk} |`,
      '',
      '### 🤖 AI Root Cause Analysis',
      rootCause.rootCause,
      '',
      '### 📊 Evidence Chain',
      `**Reasoning:** ${rootCause.reasoning}`,
      '',
      '**Contributing Factors:**',
      ...(rootCause.contributingFactors || []).map(f => `- ${f}`),
      '',
      '### 🔗 Suspected Pull Request',
      prTraceback.suspectedPR
        ? `- **PR #${prTraceback.suspectedPR.number}**: [${prTraceback.suspectedPR.title}](${prTraceback.suspectedPR.url})`
        : '- No PR identified',
      prTraceback.suspectedPR ? `- **Author:** ${prTraceback.suspectedPR.author}` : '',
      prTraceback.suspectedPR ? `- **Risk Score:** ${prTraceback.suspectedPR.riskScore}%` : '',
      prTraceback.commitAnalysis ? `\n${prTraceback.commitAnalysis}` : '',
      '',
      '### 📈 Telemetry Summary',
      `- ${telemetry.logs.length} error log entries`,
      `- ${telemetry.errorPatterns.length} distinct error patterns`,
      `- ${telemetry.anomalies.length} anomalies detected`,
      `- ${dependencies.impactedServices.length} services impacted`,
      '',
      '### 🏗️ Deployment Correlation',
      `- Version: v${deployment.suspectedDeployment?.version}`,
      `- Deployed: ${deployment.suspectedDeployment?.deployedAt}`,
      `- Files changed: ${deployment.suspectedDeployment?.changedFiles}`,
      `- Correlation: ${deployment.correlationScore}%`,
      '',
      '### 🛠️ Recommended Actions',
      ...(remediation.actions || []).map(a => `${a.priority}. **${a.action}** (risk: ${a.risk}, ETA: ${a.eta})${a.automated ? ' 🤖' : ''}`),
      '',
      '### 🛡️ Prevention Measures',
      ...(remediation.preventionMeasures || []).map(m => `- ${m}`),
      '',
      '---',
      '*Auto-generated by PRISM Multi-Agent Investigation System*',
    ].join('\n');

    const issue = await githubService.createIssue(
      owner, repoName,
      `🚨 [CRITICAL] ${context.title}`,
      issueBody,
      ['critical', 'incident', 'auto-generated', 'ai-investigation']
    );

    return issue.url;
  } catch (error) {
    console.error('Failed to create GitHub issue:', error);
    return undefined;
  }
}
