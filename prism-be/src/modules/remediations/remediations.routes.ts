import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { generateRemediation, createRemediationPR } from '../../services/remediation/remediation.service.js';
import { getRemediationQueue } from '../../jobs/queues.js';
import { env } from '../../config/env.js';

export async function remediationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/:incidentId/generate', {
    schema: {
      description: 'Generate a remediation suggestion for an incident (does NOT create a PR)',
      tags: ['Remediations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { incidentId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };

    try {
      const result = await generateRemediation(incidentId);

      if (app.io) {
        app.io.emit('remediation.generated', { incidentId, result });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remediation generation failed';
      return reply.status(400).send({ success: false, error: message });
    }
  });

  app.post('/:incidentId/create-pr', {
    schema: {
      description: 'Create a PR for the remediation (requires user approval - only call after user confirms)',
      tags: ['Remediations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { incidentId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };

    try {
      // Add to queue (only if Redis enabled)
      if (env.REDIS_ENABLED) {
        const queue = getRemediationQueue();
        await queue.add('create-pr', { incidentId });
      }

      const result = await createRemediationPR(incidentId);

      if (app.io) {
        app.io.emit('remediation.pr_created', { incidentId, result });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PR creation failed';
      return reply.status(400).send({ success: false, error: message });
    }
  });
}
