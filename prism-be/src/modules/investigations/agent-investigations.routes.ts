import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { runCoordinatorAgent } from '../../agents/coordinator/coordinator.agent.js';
import type { AgentEvent } from '../../agents/types.js';

/**
 * SSE (Server-Sent Events) endpoint for streaming agent investigation progress in real-time.
 */
export async function agentInvestigationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  /**
   * POST /investigations/:incidentId/start
   * Starts a multi-agent investigation and streams events via SSE.
   */
  app.get('/:incidentId/stream', {
    schema: {
      description: 'Stream agent investigation events via SSE',
      tags: ['Investigations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { incidentId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: AgentEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      // Run the full multi-agent investigation with live streaming
      const result = await runCoordinatorAgent(incidentId, sendEvent);

      // Send final result event
      reply.raw.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Investigation failed';
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  /**
   * POST /investigations/:incidentId/start
   * Starts a multi-agent investigation (non-streaming, returns full result).
   */
  app.post('/:incidentId/start', {
    schema: {
      description: 'Start a multi-agent investigation',
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
      const events: AgentEvent[] = [];
      const emit = (event: AgentEvent) => { events.push(event); };

      const result = await runCoordinatorAgent(incidentId, emit);

      return { ...result, events };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Investigation failed';
      return reply.status(400).send({ success: false, error: message });
    }
  });
}
