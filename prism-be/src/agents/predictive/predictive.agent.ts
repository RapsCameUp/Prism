import { splunkService } from '../../integrations/splunk/splunk.service.js';
import { cdtsmClient } from '../../integrations/cdtsm/cdtsm.client.js';
import { githubService } from '../../integrations/github/github.service.js';
import { prisma } from '../../utils/prisma.js';

const STAGGER_DELAY_MS = 15_000; // 15 seconds between each predicted incident

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Predictive Reliability Agent
 * 
 * Uses the Cisco Deep Time Series Model (CDTSM) to analyze service metrics
 * and predict degradation before it impacts users.
 * 
 * Inputs: Latency, Memory, CPU, Error Rate, Request Rate
 * Outputs: Anomaly Score, Predicted Failure Window, Forecasted Trend
 */

export interface PredictionResult {
  serviceName: string;
  metric: string;
  anomalyScore: number;
  predictedValues: number[];
  failureWindowMinutes: number;
  currentValue: number;
  trend: 'rising' | 'stable' | 'declining';
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ServicePrediction {
  serviceName: string;
  overallScore: number;
  predictions: PredictionResult[];
  predictedFailureWindow: number;
  recommendation: string;
}

const METRICS = ['memory_percent', 'cpu_percent', 'latency_ms', 'error_rate', 'request_rate'];

const ANOMALY_THRESHOLDS = {
  critical: 85,
  high: 70,
  medium: 50,
  low: 30,
};

/**
 * Fetch recent metrics for a service from Splunk.
 */
async function fetchServiceMetrics(serviceName: string): Promise<Map<string, number[]>> {
  const metricsMap = new Map<string, number[]>();

  for (const metric of METRICS) {
    try {
      const results = await splunkService.search(
        `index=metrics serviceName="${serviceName}" metric="${metric}" | sort _time | fields value | head 24`
      );

      const values = (results as Record<string, string>[])
        .map(r => parseFloat(r.value || r._raw?.split(',')[3] || '0'))
        .filter(v => !isNaN(v));

      if (values.length >= 6) {
        metricsMap.set(metric, values);
      }
    } catch (error) {
      console.error(`[PredictiveAgent] Failed to fetch ${metric} for ${serviceName}:`, error);
    }
  }

  return metricsMap;
}

/**
 * Determine trend direction from a series of values.
 */
function determineTrend(values: number[]): 'rising' | 'stable' | 'declining' {
  if (values.length < 3) return 'stable';
  const recent = values.slice(-3);
  const earlier = values.slice(-6, -3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg;
  const change = (recentAvg - earlierAvg) / (earlierAvg || 1);

  if (change > 0.05) return 'rising';
  if (change < -0.05) return 'declining';
  return 'stable';
}

/**
 * Map anomaly score to severity level.
 */
function scoreSeverity(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= ANOMALY_THRESHOLDS.critical) return 'critical';
  if (score >= ANOMALY_THRESHOLDS.high) return 'high';
  if (score >= ANOMALY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Run predictive analysis for a single service using CDTSM.
 */
async function analyzeService(serviceName: string): Promise<ServicePrediction | null> {
  const metricsMap = await fetchServiceMetrics(serviceName);

  if (metricsMap.size === 0) {
    console.log(`[PredictiveAgent] No metrics available for ${serviceName}`);
    return null;
  }

  const predictions: PredictionResult[] = [];
  let consecutiveFailures = 0;

  for (const [metric, values] of metricsMap.entries()) {
    // Skip remaining metrics if CDTSM is consistently failing (circuit breaker)
    if (consecutiveFailures >= 2) {
      console.warn(`[PredictiveAgent] Skipping ${serviceName}/${metric} - CDTSM unresponsive (${consecutiveFailures} consecutive failures)`);
      continue;
    }

    try {
      // Split into coarse (downsampled) and fine (recent high-res) context
      const midpoint = Math.floor(values.length / 2);
      const coarseCtx = values.slice(0, midpoint);
      const fineCtx = values.slice(midpoint);

      const { score, predictedValues, failureWindowMinutes } =
        await cdtsmClient.computeAnomalyScore(coarseCtx, fineCtx, 6);

      predictions.push({
        serviceName,
        metric,
        anomalyScore: score,
        predictedValues,
        failureWindowMinutes,
        currentValue: values[values.length - 1],
        trend: determineTrend(values),
        severity: scoreSeverity(score),
      });
      consecutiveFailures = 0; // Reset on success
    } catch (error) {
      consecutiveFailures++;
      console.error(`[PredictiveAgent] CDTSM inference failed for ${serviceName}/${metric}:`, error instanceof Error ? error.message : error);
    }
  }

  if (predictions.length === 0) return null;

  // Compute overall score (weighted max across metrics)
  const overallScore = Math.max(...predictions.map(p => p.anomalyScore));
  const minFailureWindow = Math.min(
    ...predictions.filter(p => p.failureWindowMinutes > 0).map(p => p.failureWindowMinutes),
    Infinity
  );

  const criticalMetrics = predictions.filter(p => p.severity === 'critical' || p.severity === 'high');
  const recommendation = criticalMetrics.length > 0
    ? `Immediate attention required: ${criticalMetrics.map(p => p.metric).join(', ')} showing degradation pattern. Predicted failure in ${minFailureWindow === Infinity ? 'unknown' : minFailureWindow + ' minutes'}.`
    : `Service health stable. Continue monitoring.`;

  return {
    serviceName,
    overallScore,
    predictions,
    predictedFailureWindow: minFailureWindow === Infinity ? 0 : minFailureWindow,
    recommendation,
  };
}

/**
 * Run the Predictive Reliability Agent across all monitored services.
 * Creates predictive incidents for services showing degradation patterns.
 */
export async function runPredictiveAgent(): Promise<ServicePrediction[]> {
  console.log('[PredictiveAgent] Starting prediction cycle...');

  // Check CDTSM availability
  const ready = await cdtsmClient.isReady();
  if (!ready) {
    console.warn('[PredictiveAgent] CDTSM Inference Host is not available. Skipping prediction cycle.');
    return [];
  }

  // Get all monitored services from repositories
  const repos = await prisma.repository.findMany({ where: { isActive: true } });
  const services = repos.map(r => r.serviceName);

  if (services.length === 0) {
    console.log('[PredictiveAgent] No active services to monitor.');
    return [];
  }

  const results: ServicePrediction[] = [];
  const pendingIncidents: ServicePrediction[] = [];

  for (const service of services) {
    const prediction = await analyzeService(service);
    if (prediction && prediction.overallScore >= ANOMALY_THRESHOLDS.medium) {
      results.push(prediction);

      // Queue predicted incident creation if score is high enough
      if (prediction.overallScore >= ANOMALY_THRESHOLDS.high) {
        pendingIncidents.push(prediction);
      }
    }
  }

  // Create predicted incidents one by one with a stagger delay
  for (let i = 0; i < pendingIncidents.length; i++) {
    if (i > 0) {
      console.log(`[PredictiveAgent] Waiting ${STAGGER_DELAY_MS / 1000}s before next prediction...`);
      await delay(STAGGER_DELAY_MS);
    }
    await createPredictiveIncident(pendingIncidents[i]);
  }

  console.log(`[PredictiveAgent] Cycle complete. ${results.length} services with anomalies detected.`);
  return results;
}

/**
 * Create a predictive incident in the database.
 * These incidents are tagged as "predicted" and show up with the AI Predicted badge.
 */
async function createPredictiveIncident(prediction: ServicePrediction): Promise<void> {
  // Check if we already have an active predicted incident for this service
  const existing = await prisma.incident.findFirst({
    where: {
      serviceName: prediction.serviceName,
      source: 'cdtsm-prediction',
      status: { in: ['open', 'investigating'] },
    },
  });

  if (existing) {
    // Update the existing prediction with latest scores
    await prisma.incident.update({
      where: { id: existing.id },
      data: {
        confidenceScore: prediction.overallScore,
        description: buildPredictionDescription(prediction),
      },
    });
    console.log(`[PredictiveAgent] Updated existing prediction for ${prediction.serviceName}: ${existing.id}`);
    return;
  }

  const severity = prediction.overallScore >= ANOMALY_THRESHOLDS.critical ? 'critical'
    : prediction.overallScore >= ANOMALY_THRESHOLDS.high ? 'high' : 'medium';

  const criticalMetrics = prediction.predictions
    .filter(p => p.anomalyScore >= ANOMALY_THRESHOLDS.medium)
    .sort((a, b) => b.anomalyScore - a.anomalyScore);

  const title = `${prediction.serviceName} degradation - ${criticalMetrics[0]?.metric || 'multiple metrics'} anomaly`;

  const incident = await prisma.incident.create({
    data: {
      title,
      description: buildPredictionDescription(prediction),
      severity,
      serviceName: prediction.serviceName,
      status: 'open',
      confidenceScore: prediction.overallScore,
      source: 'cdtsm-prediction',
      predictedAt: new Date(),
      failureWindowMinutes: prediction.predictedFailureWindow,
    },
  });

  console.log(`[PredictiveAgent] Created predictive incident: ${incident.id} for ${prediction.serviceName} (score: ${prediction.overallScore})`);

  // Auto-create GitHub issue for critical predictions
  if (severity === 'critical') {
    await createGithubIssueForPrediction(incident.id, prediction);
  }
}

function buildPredictionDescription(prediction: ServicePrediction): string {
  const lines = [
    `Cisco Deep Time Series Model predicts ${prediction.overallScore}% probability of service degradation for ${prediction.serviceName}.`,
    '',
    `Predicted failure window: ${prediction.predictedFailureWindow > 0 ? prediction.predictedFailureWindow + ' minutes' : 'Imminent'}`,
    '',
    'Metric Analysis:',
  ];

  for (const p of prediction.predictions.filter(m => m.anomalyScore >= 30)) {
    lines.push(`  • ${p.metric}: score ${p.anomalyScore}% (current: ${p.currentValue}, trend: ${p.trend})`);
  }

  lines.push('', `Recommendation: ${prediction.recommendation}`);
  return lines.join('\n');
}

/**
 * Auto-create a GitHub issue for critical predicted incidents.
 */
async function createGithubIssueForPrediction(incidentId: string, prediction: ServicePrediction): Promise<void> {
  try {
    // Find the repository for this service
    const repo = await prisma.repository.findFirst({
      where: { serviceName: prediction.serviceName, isActive: true },
    });

    if (!repo) {
      console.warn(`[PredictiveAgent] No repository found for ${prediction.serviceName}, skipping GitHub issue.`);
      return;
    }

    // Parse owner/repo from githubUrl (e.g. https://github.com/Owner/repo-name)
    const match = repo.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      console.warn(`[PredictiveAgent] Cannot parse GitHub URL: ${repo.githubUrl}`);
      return;
    }
    const [, owner, repoName] = match;

    const criticalMetrics = prediction.predictions
      .filter(p => p.anomalyScore >= ANOMALY_THRESHOLDS.medium)
      .sort((a, b) => b.anomalyScore - a.anomalyScore);

    const issueBody = [
      `## 🧠 AI-Predicted Critical Degradation`,
      '',
      `**Service:** ${prediction.serviceName}`,
      `**Anomaly Score:** ${prediction.overallScore}%`,
      `**Predicted Failure Window:** ${prediction.predictedFailureWindow > 0 ? prediction.predictedFailureWindow + ' minutes' : 'Imminent'}`,
      '',
      '### Metric Analysis',
      ...criticalMetrics.map(p => `- **${p.metric}**: score ${p.anomalyScore}% (current: ${p.currentValue}, trend: ${p.trend})`),
      '',
      `### Recommendation`,
      prediction.recommendation,
      '',
      '---',
      '*Auto-generated by PRISM Predictive Reliability Agent (CDTSM)*',
    ].join('\n');

    const issue = await githubService.createIssue(
      owner, repoName.replace(/\.git$/, ''),
      `🧠 [PREDICTED CRITICAL] ${prediction.serviceName} degradation - anomaly score ${prediction.overallScore}%`,
      issueBody,
      ['critical', 'ai-predicted', 'cdtsm', 'auto-generated']
    );

    // Link the GitHub issue to the incident
    await prisma.incident.update({
      where: { id: incidentId },
      data: { githubIssueUrl: issue.url },
    });

    console.log(`[PredictiveAgent] Created GitHub issue #${issue.number} for ${prediction.serviceName}: ${issue.url}`);
  } catch (error) {
    console.error(`[PredictiveAgent] Failed to create GitHub issue for ${prediction.serviceName}:`, error);
  }
}
