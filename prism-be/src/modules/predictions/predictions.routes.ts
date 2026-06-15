import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getPredictionSchedulerStatus,
  startPredictionScheduler,
  stopPredictionScheduler,
  triggerPredictionCycle,
} from '../../services/prediction/prediction.scheduler.js';

export async function predictionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/status', {
    schema: {
      description: 'Get prediction scheduler status',
      tags: ['Predictions'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return getPredictionSchedulerStatus();
  });

  app.post('/trigger', {
    schema: {
      description: 'Manually trigger a prediction cycle',
      tags: ['Predictions'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const results = await triggerPredictionCycle();
    return { success: true, results };
  });

  app.post('/start', {
    schema: {
      description: 'Start the prediction scheduler',
      tags: ['Predictions'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    startPredictionScheduler();
    return { success: true, message: 'Prediction scheduler started' };
  });

  app.post('/stop', {
    schema: {
      description: 'Stop the prediction scheduler',
      tags: ['Predictions'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    stopPredictionScheduler();
    return { success: true, message: 'Prediction scheduler stopped' };
  });
}
