import { Queue } from 'bullmq';
import { env } from '../config/env.js';

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

let investigationQueue: Queue | null = null;
let remediationQueue: Queue | null = null;

export function getInvestigationQueue(): Queue {
  if (!investigationQueue) {
    investigationQueue = new Queue('investigation-queue', { connection });
  }
  return investigationQueue;
}

export function getRemediationQueue(): Queue {
  if (!remediationQueue) {
    remediationQueue = new Queue('remediation-queue', { connection });
  }
  return remediationQueue;
}

export async function closeQueues() {
  if (investigationQueue) await investigationQueue.close();
  if (remediationQueue) await remediationQueue.close();
}
