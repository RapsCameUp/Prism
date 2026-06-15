import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { investigateIncident } from '../services/investigation/investigation.service.js';

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

export function createInvestigationWorker() {
  const worker = new Worker(
    'investigation-queue',
    async (job: Job<{ incidentId: string }>) => {
      console.log(`[Investigation Worker] Processing job ${job.id} for incident ${job.data.incidentId}`);

      await job.updateProgress(10);

      // Simulate telemetry analysis delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      await job.updateProgress(40);

      // Run investigation
      const result = await investigateIncident(job.data.incidentId);
      await job.updateProgress(100);

      console.log(`[Investigation Worker] Completed job ${job.id}`);
      return result;
    },
    { connection, concurrency: 3 }
  );

  worker.on('error', (err) => {
    console.error('[Investigation Worker] Error:', err);
  });

  worker.on('completed', (job) => {
    console.log(`[Investigation Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Investigation Worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
