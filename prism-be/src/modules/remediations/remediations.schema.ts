import { z } from 'zod';

export const remediationParamsSchema = z.object({
  incidentId: z.string().min(1),
});

export type RemediationParams = z.infer<typeof remediationParamsSchema>;
