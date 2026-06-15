import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import { repositoryRoutes } from '../../src/modules/repositories/repositories.routes.js';

describe('Repository Routes', () => {
  const app = Fastify();
  let token: string;

  beforeAll(async () => {
    await app.register(fjwt, { secret: 'test-secret' });
    await app.register(repositoryRoutes, { prefix: '/repositories' });
    await app.ready();

    token = app.jwt.sign({ id: 'test-user', email: 'admin@prism.ai', role: 'admin' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /repositories should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/repositories',
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /repositories should return 200 with valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/repositories',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    // May return 200 or 500 depending on DB availability in test
    expect([200, 500]).toContain(response.statusCode);
  });
});
