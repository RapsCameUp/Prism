import Fastify from 'fastify';
import cors from '@fastify/cors';
import fjwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { repositoryRoutes } from './modules/repositories/repositories.routes.js';
import { incidentRoutes } from './modules/incidents/incidents.routes.js';
import { investigationRoutes } from './modules/investigations/investigations.routes.js';
import { agentInvestigationRoutes } from './modules/investigations/agent-investigations.routes.js';
import { remediationRoutes } from './modules/remediations/remediations.routes.js';
import { predictionRoutes } from './modules/predictions/predictions.routes.js';
import { setupSocketHandlers } from './sockets/index.js';
import { setupWorkers } from './jobs/workers.js';
import { startPredictionScheduler } from './services/prediction/prediction.scheduler.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  });

  // Allow empty body for POST/PUT/PATCH requests without Content-Type
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || (body as string).length === 0) {
      done(null, undefined);
    } else {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // JWT
  await app.register(fjwt, {
    secret: env.JWT_SECRET,
  });

  // Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'PRISM API',
        description: 'AI Reliability Engineer - Incident Investigation Platform',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
  });

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(repositoryRoutes, { prefix: '/repositories' });
  await app.register(incidentRoutes, { prefix: '/incidents' });
  await app.register(investigationRoutes, { prefix: '/investigations' });
  await app.register(agentInvestigationRoutes, { prefix: '/investigations/agent' });
  await app.register(remediationRoutes, { prefix: '/remediations' });
  await app.register(predictionRoutes, { prefix: '/predictions' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Setup Socket.IO after server is listening
  app.addHook('onReady', async () => {
    const io = new SocketIOServer(app.server, {
      cors: {
        origin: env.CLIENT_URL,
        credentials: true,
      },
    });
    app.decorate('io', io);
    setupSocketHandlers(app);
    setupWorkers(app);

    // Start Predictive Reliability Agent scheduler if enabled
    if (env.PREDICTION_ENABLED) {
      startPredictionScheduler();
    }
  });

  return app;
}
