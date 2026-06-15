import { z } from 'zod';

export const createRepositorySchema = z.object({
  name: z.string().min(1),
  serviceName: z.string().min(1),
  githubUrl: z.string().url(),
  defaultBranch: z.string().default('main'),
  environment: z.string().default('production'),
  isActive: z.boolean().default(true),
});

export const updateRepositorySchema = createRepositorySchema.partial();

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
export type UpdateRepositoryInput = z.infer<typeof updateRepositorySchema>;
