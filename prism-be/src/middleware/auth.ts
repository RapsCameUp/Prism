import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<{ id: string; email: string; role: string }>();
    request.jwtPayload = decoded;
  } catch (err) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}
