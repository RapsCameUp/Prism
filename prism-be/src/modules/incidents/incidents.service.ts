import { prisma } from '../../utils/prisma.js';
import { splunkService } from '../../integrations/splunk/splunk.service.js';
import type { CreateIncidentInput, UpdateIncidentInput } from './incidents.schema.js';

export async function getAllIncidents() {
  // Get incidents from Splunk (detected incidents)
  const splunkIncidents = await splunkService.getIncidents();

  const detectedIncidents = splunkIncidents.map(inc => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    severity: inc.severity,
    serviceName: inc.serviceName,
    status: inc.status,
    confidenceScore: inc.confidenceScore,
    githubIssueUrl: null,
    source: null as string | null,
    predictedAt: null as string | null,
    failureWindowMinutes: null as number | null,
    detectedAt: inc.detectedAt,
    createdAt: inc.detectedAt,
  }));

  // Get predicted incidents from database (created by CDTSM agent)
  const predictedIncidents = await prisma.incident.findMany({
    where: { source: 'cdtsm-prediction' },
    orderBy: { createdAt: 'desc' },
  });

  const predicted = predictedIncidents.map(inc => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    severity: inc.severity,
    serviceName: inc.serviceName,
    status: inc.status,
    confidenceScore: inc.confidenceScore,
    githubIssueUrl: inc.githubIssueUrl,
    source: inc.source,
    predictedAt: inc.predictedAt?.toISOString() ?? null,
    failureWindowMinutes: inc.failureWindowMinutes,
    detectedAt: inc.detectedAt.toISOString(),
    createdAt: inc.createdAt.toISOString(),
  }));

  // Merge both sources, predicted first (most urgent)
  return [...predicted, ...detectedIncidents];
}

export async function getIncidentById(id: string) {
  // First check if it's a predicted incident in the DB (ObjectId format)
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    const dbIncident = await prisma.incident.findUnique({ where: { id } });
    if (dbIncident) {
      return {
        id: dbIncident.id,
        title: dbIncident.title,
        description: dbIncident.description,
        severity: dbIncident.severity,
        serviceName: dbIncident.serviceName,
        status: dbIncident.status,
        confidenceScore: dbIncident.confidenceScore,
        githubIssueUrl: dbIncident.githubIssueUrl,
        source: dbIncident.source,
        predictedAt: dbIncident.predictedAt?.toISOString() ?? null,
        failureWindowMinutes: dbIncident.failureWindowMinutes,
        detectedAt: dbIncident.detectedAt.toISOString(),
        createdAt: dbIncident.createdAt.toISOString(),
      };
    }
  }

  // Otherwise look in Splunk
  const incident = await splunkService.getIncidentById(id);
  if (!incident) throw new Error('Incident not found');

  return {
    id: incident.id,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    serviceName: incident.serviceName,
    status: incident.status,
    confidenceScore: incident.confidenceScore,
    githubIssueUrl: null,
    source: null,
    predictedAt: null,
    failureWindowMinutes: null,
    detectedAt: incident.detectedAt,
    createdAt: incident.detectedAt,
  };
}

export async function createIncident(data: CreateIncidentInput) {
  return prisma.incident.create({
    data: {
      ...data,
      detectedAt: data.detectedAt ? new Date(data.detectedAt) : new Date(),
    },
  });
}

export async function updateIncident(id: string, data: UpdateIncidentInput) {
  return prisma.incident.update({
    where: { id },
    data: {
      ...data,
      detectedAt: data.detectedAt ? new Date(data.detectedAt) : undefined,
    },
  });
}
