import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { investigateIncident, getInvestigationByIncidentId } from '../../services/investigation/investigation.service.js';
import { getInvestigationQueue } from '../../jobs/queues.js';
import { env } from '../../config/env.js';

export async function investigationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/:incidentId/start', {
    schema: {
      description: 'Start an investigation for an incident',
      tags: ['Investigations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { incidentId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };

    try {
      // Emit socket event
      if (app.io) {
        app.io.emit('investigation.started', { incidentId });
      }

      // Add to queue for background processing (only if Redis enabled)
      if (env.REDIS_ENABLED) {
        const queue = getInvestigationQueue();
        await queue.add('investigate', { incidentId });
      }

      // Also run synchronously for immediate response
      const result = await investigateIncident(incidentId);

      if (app.io) {
        app.io.emit('investigation.completed', { incidentId, result });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Investigation failed';
      return reply.status(400).send({ success: false, error: message });
    }
  });

  app.get('/:incidentId', {
    schema: {
      description: 'Get investigation details for an incident',
      tags: ['Investigations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { incidentId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };
    try {
      const result = await getInvestigationByIncidentId(incidentId);
      return result;
    } catch {
      return reply.status(404).send({ success: false, error: 'Investigation not found' });
    }
  });
}
