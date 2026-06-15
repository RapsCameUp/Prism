import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { createRemediationPR } from '../services/remediation/remediation.service.js';

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

export function createRemediationWorker() {
  const worker = new Worker(
    'remediation-queue',
    async (job: Job<{ incidentId: string }>) => {
      console.log(`[Remediation Worker] Processing job ${job.id} for incident ${job.data.incidentId}`);

      await job.updateProgress(10);

      // Simulate PR creation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      await job.updateProgress(50);

      const result = await createRemediationPR(job.data.incidentId);
      await job.updateProgress(100);

      console.log(`[Remediation Worker] Completed job ${job.id}`);
      return result;
    },
    { connection, concurrency: 2 }
  );

  worker.on('error', (err) => {
    console.error('[Remediation Worker] Error:', err);
  });

  worker.on('completed', (job) => {
    console.log(`[Remediation Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Remediation Worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
