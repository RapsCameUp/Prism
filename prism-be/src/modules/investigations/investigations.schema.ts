import { z } from 'zod';

export const startInvestigationParamsSchema = z.object({
  incidentId: z.string().min(1),
});

export type StartInvestigationParams = z.infer<typeof startInvestigationParamsSchema>;
