import { z } from 'zod';

export const createIncidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  serviceName: z.string().min(1),
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).default('open'),
  confidenceScore: z.number().min(0).max(100).optional(),
  detectedAt: z.string().datetime().optional(),
});

export const updateIncidentSchema = createIncidentSchema.partial();

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
