import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import { authRoutes } from '../../src/modules/auth/auth.routes.js';

describe('Auth Routes', () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(fjwt, { secret: 'test-secret' });
    await app.register(authRoutes, { prefix: '/auth' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login should return 401 for invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'wrong@email.com',
        password: 'wrong',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/me should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });
});
