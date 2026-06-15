import { prisma } from '../../utils/prisma.js';
import type { CreateRepositoryInput, UpdateRepositoryInput } from './repositories.schema.js';

export async function getAllRepositories() {
  return prisma.repository.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getRepositoryById(id: string) {
  const repo = await prisma.repository.findUnique({ where: { id } });
  if (!repo) throw new Error('Repository not found');
  return repo;
}

export async function createRepository(data: CreateRepositoryInput) {
  return prisma.repository.create({ data });
}

export async function updateRepository(id: string, data: UpdateRepositoryInput) {
  return prisma.repository.update({ where: { id }, data });
}

export async function deleteRepository(id: string) {
  return prisma.repository.delete({ where: { id } });
}
