import { FastifyInstance } from 'fastify';
import { loginSchema } from './auth.schema.js';
import { loginUser, getUserById } from './auth.service.js';
import { authenticate } from '../../middleware/auth.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', {
    schema: {
      description: 'Authenticate user and return JWT',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    try {
      const user = await loginUser(body);
      const token = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '24h' }
      );
      return { token, user };
    } catch (err) {
      reply.code(401);
      return { success: false, error: 'Invalid email or password' };
    }
  });

  app.get('/me', {
    onRequest: [authenticate],
    schema: {
      description: 'Get current authenticated user',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const user = await getUserById(request.jwtPayload.id);
      return user;
    } catch (err) {
      reply.code(404);
      return { success: false, error: 'User not found' };
    }
  });
}
