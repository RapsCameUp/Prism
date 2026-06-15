import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { createIncidentSchema, updateIncidentSchema } from './incidents.schema.js';
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
} from './incidents.service.js';
import { splunkService } from '../../integrations/splunk/splunk.service.js';
import { prisma } from '../../utils/prisma.js';
import { generateTraces } from '../../agents/telemetry/data-generators.js';
import { queryGemini } from '../../integrations/gemini/gemini.client.js';

export async function incidentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', {
    schema: {
      description: 'List all incidents',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return getAllIncidents();
  });

  app.get('/:id', {
    schema: {
      description: 'Get incident by ID',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getIncidentById(id);
    } catch {
      return reply.status(404).send({ success: false, error: 'Incident not found' });
    }
  });

  app.post('/', {
    schema: {
      description: 'Create an incident',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'description', 'severity', 'serviceName'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          serviceName: { type: 'string' },
          status: { type: 'string', enum: ['open', 'investigating', 'resolved', 'closed'] },
          confidenceScore: { type: 'number' },
          detectedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const data = createIncidentSchema.parse(request.body);
    const incident = await createIncident(data);
    return reply.status(201).send(incident);
  });

  app.patch('/:id', {
    schema: {
      description: 'Update an incident',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateIncidentSchema.parse(request.body);
    try {
      return await updateIncident(id, data);
    } catch {
      return reply.status(404).send({ success: false, error: 'Incident not found' });
    }
  });

  // Get logs and traces for an incident's service
  app.get('/:id/logs', {
    schema: {
      description: 'Get logs for an incident service from Splunk',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const incident = await getIncidentById(id);
      const logs = await splunkService.getIncidentLogs(incident.serviceName);
      const traces = generateTraces(incident.serviceName);
      return {
        logs: logs.map(l => ({
          time: l.timestamp.split('T')[1]?.slice(0, 8) || l.timestamp,
          level: l.severity,
          svc: l.serviceName,
          msg: l.message,
        })),
        traces: traces.map(t => ({
          id: t.spanId.slice(0, 8),
          svc: t.serviceName,
          duration: t.duration,
          status: t.status === 'OK' ? 'ok' : 'err',
        })),
      };
    } catch {
      return reply.status(404).send({ success: false, error: 'Incident not found' });
    }
  });

  // Get remediation status for an incident
  app.get('/:id/remediation', {
    schema: {
      description: 'Get remediation status for an incident',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const remediation = await prisma.remediation.findFirst({
      where: { incidentId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!remediation) {
      return { exists: false, prUrl: null, status: null };
    }
    return { exists: true, prUrl: remediation.prUrl, status: remediation.status };
  });

  // Ask AI a question with incident context
  app.post('/:id/ask', {
    schema: {
      description: 'Ask Gemini a question with incident context',
      tags: ['Incidents'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { question } = request.body as { question: string };

    if (!question || question.trim().length === 0) {
      return reply.status(400).send({ error: 'Question is required' });
    }

    try {
      const incident = await getIncidentById(id);

      // Gather investigation context if available
      const investigation = await prisma.investigation.findFirst({
        where: { incidentId: id },
        orderBy: { createdAt: 'desc' },
      });

      // Build context prompt
      let context = `You are an SRE AI assistant helping with a production incident. Answer concisely and practically.\n\n`;
      context += `## Incident Context\n`;
      context += `- **Title:** ${incident.title}\n`;
      context += `- **Service:** ${incident.serviceName}\n`;
      context += `- **Severity:** ${incident.severity}\n`;
      context += `- **Status:** ${incident.status}\n`;
      context += `- **Detected:** ${incident.detectedAt}\n`;

      if (investigation) {
        context += `\n## Investigation Summary\n${investigation.summary}\n`;
        context += `\n## Root Cause\n${investigation.rootCause}\n`;
        if (investigation.confidenceScore) {
          context += `- Confidence: ${investigation.confidenceScore}%\n`;
        }

        const meta = investigation.metadata as Record<string, unknown> | null;
        if (meta) {
          const remediation = meta.remediation as { actions?: { priority: number; action: string; risk: string; eta: string }[]; rollbackRecommended?: boolean; preventionMeasures?: string[] } | undefined;
          if (remediation?.actions && remediation.actions.length > 0) {
            context += `\n## Recommended Actions\n`;
            for (const a of remediation.actions) {
              context += `${a.priority}. ${a.action} (risk: ${a.risk}, eta: ${a.eta})\n`;
            }
            if (remediation.rollbackRecommended) {
              context += `⚠️ Rollback is recommended.\n`;
            }
          }
          if (remediation?.preventionMeasures && remediation.preventionMeasures.length > 0) {
            context += `\n## Prevention Measures\n`;
            for (const m of remediation.preventionMeasures) {
              context += `- ${m}\n`;
            }
          }
          const rootCauseDetails = meta.rootCauseDetails as { reasoning?: string; contributingFactors?: string[] } | undefined;
          if (rootCauseDetails?.reasoning) {
            context += `\n## Root Cause Details\n${rootCauseDetails.reasoning}\n`;
          }
        }
      }

      context += `\n## User Question\n${question}\n`;

      const answer = await queryGemini(context);
      return { answer };
    } catch (error) {
      console.error('Ask AI error:', error);
      return reply.status(500).send({ error: 'Failed to get AI response' });
    }
  });
}
