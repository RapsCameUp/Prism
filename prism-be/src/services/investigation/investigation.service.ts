import { prisma } from '../../utils/prisma.js';
import { splunkService } from '../../integrations/splunk/splunk.service.js';
import { githubService } from '../../integrations/github/github.service.js';

export interface InvestigationResult {
  summary: string;
  rootCause: string;
  suspectedPrNumber: number | null;
  suspectedPrUrl: string | null;
  confidenceScore: number;
}

export async function investigateIncident(incidentId: string): Promise<InvestigationResult> {
  // 1. Load incident — check DB first (predicted incidents), then Splunk (detected)
  let incident: { id: string; title: string; severity: string; serviceName: string; detectedAt: Date | string } | null = null;
  let isDbIncident = false;

  if (incidentId.match(/^[0-9a-fA-F]{24}$/)) {
    const dbIncident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (dbIncident) {
      incident = dbIncident;
      isDbIncident = true;
    }
  }

  if (!incident) {
    const splunkIncident = await splunkService.getIncidentById(incidentId);
    if (splunkIncident) {
      incident = {
        id: splunkIncident.id,
        title: splunkIncident.title,
        severity: splunkIncident.severity,
        serviceName: splunkIncident.serviceName,
        detectedAt: splunkIncident.detectedAt,
      };
    }
  }

  if (!incident) {
    throw new Error('Incident not found');
  }

  // 2. Query Splunk logs
  const logs = await splunkService.getIncidentLogs(incident.serviceName);
  const deploymentEvents = await splunkService.getDeploymentEvents(incident.serviceName);
  const serviceErrors = await splunkService.getServiceErrors(incident.serviceName);

  // 3. Identify the most recent deployment (likely cause)
  const recentDeployment = deploymentEvents[0];

  // 4. Identify suspected PR
  let suspectedPrNumber: number | null = null;
  let suspectedPrUrl: string | null = null;

  if (recentDeployment) {
    suspectedPrNumber = recentDeployment.prNumber;

    // Find the repository for this service
    const repo = await prisma.repository.findFirst({
      where: { serviceName: incident.serviceName },
    });

    if (repo) {
      const urlParts = repo.githubUrl.replace('https://github.com/', '').split('/');
      const owner = urlParts[0];
      const repoName = urlParts[1];

      const pr = await githubService.getPullRequest(owner, repoName, suspectedPrNumber);
      suspectedPrUrl = pr.url;
    } else {
      suspectedPrUrl = `https://github.com/company/${incident.serviceName}/pull/${suspectedPrNumber}`;
    }
  }

  // 5. Build investigation result
  const rootCauseMessages = serviceErrors.map(e => e.message).join('; ');
  const confidenceScore = calculateConfidence(logs.length, serviceErrors.length, !!recentDeployment);

  const result: InvestigationResult = {
    summary: `Investigation of ${incident.title}: Found ${logs.length} error logs and ${serviceErrors.length} distinct errors. Most recent deployment (v${recentDeployment?.version ?? 'unknown'}) is the likely trigger.`,
    rootCause: rootCauseMessages || `Service degradation in ${incident.serviceName} correlated with recent deployment`,
    suspectedPrNumber,
    suspectedPrUrl,
    confidenceScore,
  };

  // 6. Store investigation
  const metadata = {
    telemetrySummary: {
      logCount: logs.length,
      errorPatterns: serviceErrors.map(e => ({ message: e.message, count: 1, firstSeen: e.timestamp })),
      anomalies: [],
      traceCount: 0,
    },
    deployment: {
      suspectedDeployment: recentDeployment ? {
        version: recentDeployment.version,
        deployedAt: recentDeployment.deployedAt,
        deployedBy: 'ci-pipeline',
        changedFiles: 0,
        prNumber: recentDeployment.prNumber,
      } : null,
      correlationScore: recentDeployment ? 75 : 0,
      timelineAnalysis: recentDeployment ? `Deployment of v${recentDeployment.version} occurred shortly before incident detection` : 'No recent deployments found',
    },
    rootCauseDetails: {
      reasoning: `Analysis based on ${logs.length} error logs and ${serviceErrors.length} distinct error patterns`,
      contributingFactors: serviceErrors.map(e => e.message),
      timeline: [],
    },
    dependencies: {
      impactedServices: [incident.serviceName],
      cascadeRisk: 'medium' as const,
    },
    remediation: {
      actions: [
        { priority: 1, action: recentDeployment ? `Rollback to previous version` : 'Restart affected service pods', risk: 'low', eta: '5 minutes', automated: true },
        { priority: 2, action: 'Investigate root cause in error logs', risk: 'low', eta: '15 minutes', automated: false },
      ],
      rollbackRecommended: !!recentDeployment,
      preventionMeasures: ['Add circuit breaker', 'Improve monitoring coverage'],
    },
    prTraceback: {
      suspectedPR: suspectedPrNumber ? { number: suspectedPrNumber, url: suspectedPrUrl } : null,
      commitAnalysis: '',
      relatedPRs: [],
    },
  };

  await prisma.investigation.create({
    data: {
      incidentId,
      summary: result.summary,
      rootCause: result.rootCause,
      suspectedPrNumber: result.suspectedPrNumber,
      suspectedPrUrl: result.suspectedPrUrl,
      confidenceScore: result.confidenceScore,
      metadata,
    },
  });

  // Update incident status (only for DB incidents)
  if (isDbIncident) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'investigating', confidenceScore: result.confidenceScore },
    });
  }

  // 7. Auto-create GitHub issue for critical incidents
  if (incident.severity === 'critical') {
    try {
      const repo = await prisma.repository.findFirst({
        where: { serviceName: incident.serviceName },
      });

      if (repo) {
        const urlParts = repo.githubUrl.replace('https://github.com/', '').split('/');
        const owner = urlParts[0];
        const repoName = urlParts[1];

        const issueBody = [
          `## 🚨 Critical Incident: ${incident.title}`,
          '',
          `**Severity:** Critical`,
          `**Service:** ${incident.serviceName}`,
          `**Detected:** ${typeof incident.detectedAt === 'string' ? incident.detectedAt : incident.detectedAt.toISOString()}`,
          `**Confidence Score:** ${result.confidenceScore}%`,
          '',
          '### AI Investigation Summary',
          result.summary,
          '',
          '### Root Cause',
          result.rootCause,
          '',
          '### Suspected Pull Request',
          result.suspectedPrNumber
            ? `- **PR #${result.suspectedPrNumber}**: ${result.suspectedPrUrl}`
            : '- No PR identified',
          '',
          '### Telemetry Evidence',
          `- ${logs.length} error log entries detected`,
          `- ${serviceErrors.length} distinct error patterns`,
          `- Most recent deployment: v${recentDeployment?.version ?? 'unknown'}`,
          recentDeployment ? `- Deployment time: ${recentDeployment.deployedAt}` : '',
          '',
          '### Suggested Actions',
          `1. Review PR #${result.suspectedPrNumber ?? 'N/A'} for regression`,
          `2. Check ${incident.serviceName} resource utilization`,
          `3. Consider rollback to previous version`,
          `4. Monitor error rate after mitigation`,
          '',
          '---',
          `*Auto-generated by PRISM AI Investigation Engine*`,
        ].join('\n');

        const issue = await githubService.createIssue(
          owner,
          repoName,
          `🚨 [CRITICAL] ${incident.title}`,
          issueBody,
          ['critical', 'incident', 'auto-generated']
        );

        // Store issue URL on incident (only for DB incidents)
        if (isDbIncident) {
          await prisma.incident.update({
            where: { id: incidentId },
            data: { githubIssueUrl: issue.url },
          });
        }
      }
    } catch (error) {
      console.error('Failed to create GitHub issue for critical incident:', error);
      // Don't fail the investigation if issue creation fails
    }
  }

  return result;
}

function calculateConfidence(logCount: number, errorCount: number, hasDeployment: boolean): number {
  let score = 50;
  if (logCount > 2) score += 10;
  if (logCount > 5) score += 10;
  if (errorCount > 0) score += 15;
  if (hasDeployment) score += 15;
  return Math.min(score, 98);
}

export async function getInvestigationByIncidentId(incidentId: string) {
  const investigation = await prisma.investigation.findFirst({
    where: { incidentId },
    orderBy: { createdAt: 'desc' },
  });
  if (!investigation) throw new Error('Investigation not found');
  return investigation;
}
