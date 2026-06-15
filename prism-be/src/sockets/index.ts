import { FastifyInstance } from 'fastify';

export function setupSocketHandlers(app: FastifyInstance) {
  if (!app.io) {
    app.log.warn('Socket.IO not available, skipping socket setup');
    return;
  }

  app.io.on('connection', (socket) => {
    app.log.info(`Client connected: ${socket.id}`);

    socket.on('subscribe:incident', (incidentId: string) => {
      socket.join(`incident:${incidentId}`);
      app.log.debug(`Client ${socket.id} subscribed to incident:${incidentId}`);
    });

    socket.on('unsubscribe:incident', (incidentId: string) => {
      socket.leave(`incident:${incidentId}`);
    });

    socket.on('disconnect', () => {
      app.log.info(`Client disconnected: ${socket.id}`);
    });
  });

  app.log.info('Socket.IO handlers configured');
}

// Helper to emit events from anywhere
export function emitEvent(app: FastifyInstance, event: string, data: unknown) {
  if (app.io) {
    app.io.emit(event, data);
  }
}

export function emitToRoom(app: FastifyInstance, room: string, event: string, data: unknown) {
  if (app.io) {
    app.io.to(room).emit(event, data);
  }
}
