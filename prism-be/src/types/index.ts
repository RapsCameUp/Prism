import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Server } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
  interface FastifyRequest {
    jwtPayload: {
      id: string;
      email: string;
      role: string;
    };
  }
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
