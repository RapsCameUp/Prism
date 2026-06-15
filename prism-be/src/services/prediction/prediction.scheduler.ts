import { runPredictiveAgent } from '../../agents/predictive/predictive.agent.js';
import { env } from '../../config/env.js';

/**
 * Prediction Scheduler
 * 
 * Runs the Predictive Reliability Agent on a configurable interval.
 * Default: every 2 minutes. Change via PREDICTION_INTERVAL_MINUTES env var.
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;
let lastRunResults: unknown = null;

export function getPredictionSchedulerStatus() {
  return {
    running: isRunning,
    intervalMinutes: parseInt(env.PREDICTION_INTERVAL_MINUTES || '2', 10),
    lastRunAt: lastRunAt?.toISOString() ?? null,
    nextRunAt: lastRunAt
      ? new Date(lastRunAt.getTime() + parseInt(env.PREDICTION_INTERVAL_MINUTES || '2', 10) * 60000).toISOString()
      : null,
    lastRunResults,
  };
}

export function startPredictionScheduler(): void {
  if (intervalId) {
    console.log('[PredictionScheduler] Already running.');
    return;
  }

  const intervalMinutes = parseInt(env.PREDICTION_INTERVAL_MINUTES || '2', 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[PredictionScheduler] Starting with interval: ${intervalMinutes} minutes`);

  // Run immediately on start
  executePredictionCycle();

  // Then schedule recurring runs
  intervalId = setInterval(executePredictionCycle, intervalMs);
}

export function stopPredictionScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[PredictionScheduler] Stopped.');
  }
}

/**
 * Manually trigger a prediction cycle (used by the API route).
 */
export async function triggerPredictionCycle(): Promise<unknown> {
  return executePredictionCycle();
}

async function executePredictionCycle(): Promise<unknown> {
  if (isRunning) {
    console.log('[PredictionScheduler] Skipping — previous cycle still running.');
    return lastRunResults;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const results = await runPredictiveAgent();
    lastRunAt = new Date();
    lastRunResults = {
      servicesAnalyzed: results.length,
      anomaliesDetected: results.filter(r => r.overallScore >= 70).length,
      predictions: results.map(r => ({
        service: r.serviceName,
        score: r.overallScore,
        failureWindow: r.predictedFailureWindow,
        recommendation: r.recommendation,
      })),
      durationMs: Date.now() - startTime,
    };
    console.log(`[PredictionScheduler] Cycle complete in ${Date.now() - startTime}ms. ${results.length} services analyzed.`);
    return lastRunResults;
  } catch (error) {
    console.error('[PredictionScheduler] Cycle failed:', error);
    lastRunResults = { error: error instanceof Error ? error.message : 'Unknown error' };
    return lastRunResults;
  } finally {
    isRunning = false;
  }
}
