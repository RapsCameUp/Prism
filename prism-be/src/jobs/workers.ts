import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { createInvestigationWorker } from './investigation.job.js';
import { createRemediationWorker } from './remediation.job.js';

export function setupWorkers(app: FastifyInstance) {
  if (!env.REDIS_ENABLED) {
    app.log.info('Redis disabled (REDIS_ENABLED=false) — BullMQ workers skipped');
    return;
  }

  try {
    const investigationWorker = createInvestigationWorker();
    const remediationWorker = createRemediationWorker();

    app.log.info('BullMQ workers started: investigation-queue, remediation-queue');

    // Graceful shutdown
    app.addHook('onClose', async () => {
      await investigationWorker.close();
      await remediationWorker.close();
    });
  } catch (error) {
    app.log.warn(`Failed to start BullMQ workers (Redis may not be available): ${error}`);
  }
}
