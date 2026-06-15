import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { createRepositorySchema, updateRepositorySchema } from './repositories.schema.js';
import {
  getAllRepositories,
  getRepositoryById,
  createRepository,
  updateRepository,
  deleteRepository,
} from './repositories.service.js';

export async function repositoryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', {
    schema: {
      description: 'List all repositories',
      tags: ['Repositories'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return getAllRepositories();
  });

  app.get('/:id', {
    schema: {
      description: 'Get repository by ID',
      tags: ['Repositories'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getRepositoryById(id);
    } catch {
      return reply.status(404).send({ success: false, error: 'Repository not found' });
    }
  });

  app.post('/', {
    schema: {
      description: 'Create a repository',
      tags: ['Repositories'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'serviceName', 'githubUrl'],
        properties: {
          name: { type: 'string' },
          serviceName: { type: 'string' },
          githubUrl: { type: 'string' },
          defaultBranch: { type: 'string' },
          environment: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const data = createRepositorySchema.parse(request.body);
    const repo = await createRepository(data);
    return reply.status(201).send(repo);
  });

  app.put('/:id', {
    schema: {
      description: 'Update a repository',
      tags: ['Repositories'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateRepositorySchema.parse(request.body);
    try {
      return await updateRepository(id, data);
    } catch {
      return reply.status(404).send({ success: false, error: 'Repository not found' });
    }
  });

  app.delete('/:id', {
    schema: {
      description: 'Delete a repository',
      tags: ['Repositories'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteRepository(id);
      return { success: true };
    } catch {
      return reply.status(404).send({ success: false, error: 'Repository not found' });
    }
  });
}
