import { FastifyInstance } from 'fastify';

export function createLogger(app: FastifyInstance) {
  return app.log;
}
