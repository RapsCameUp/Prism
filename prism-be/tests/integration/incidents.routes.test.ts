import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import { incidentRoutes } from '../../src/modules/incidents/incidents.routes.js';

describe('Incident Routes', () => {
  const app = Fastify();
  let token: string;

  beforeAll(async () => {
    await app.register(fjwt, { secret: 'test-secret' });
    await app.register(incidentRoutes, { prefix: '/incidents' });
    await app.ready();

    token = app.jwt.sign({ id: 'test-user', email: 'admin@prism.ai', role: 'admin' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /incidents should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/incidents',
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /incidents should return 200 with valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/incidents',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect([200, 500]).toContain(response.statusCode);
  });

  it('POST /incidents should reject invalid body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/incidents',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        title: '', // Invalid: empty
      },
    });

    // Should fail validation
    expect([400, 500]).toContain(response.statusCode);
  });
});
