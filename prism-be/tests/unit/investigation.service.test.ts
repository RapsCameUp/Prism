import { describe, it, expect, vi, beforeEach } from 'vitest';
import { investigateIncident } from '../../src/services/investigation/investigation.service.js';

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: {
    incident: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    repository: {
      findFirst: vi.fn(),
    },
    investigation: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../src/integrations/splunk/splunk.service.js', () => ({
  splunkService: {
    getIncidentLogs: vi.fn(),
    getDeploymentEvents: vi.fn(),
    getServiceErrors: vi.fn(),
  },
}));

vi.mock('../../src/integrations/github/github.service.js', () => ({
  githubService: {
    getPullRequest: vi.fn(),
  },
}));

import { prisma } from '../../src/utils/prisma.js';
import { splunkService } from '../../src/integrations/splunk/splunk.service.js';
import { githubService } from '../../src/integrations/github/github.service.js';

describe('Investigation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should investigate an incident and return results', async () => {
    const mockIncident = {
      id: 'inc-123',
      title: 'Redis Memory Leak',
      serviceName: 'checkout-service',
      severity: 'critical',
      status: 'open',
    };

    const mockRepo = {
      id: 'repo-1',
      serviceName: 'checkout-service',
      githubUrl: 'https://github.com/company/checkout-service',
      defaultBranch: 'main',
    };

    vi.mocked(prisma.incident.findUnique).mockResolvedValue(mockIncident as any);
    vi.mocked(prisma.repository.findFirst).mockResolvedValue(mockRepo as any);
    vi.mocked(prisma.investigation.create).mockResolvedValue({} as any);
    vi.mocked(prisma.incident.update).mockResolvedValue({} as any);

    vi.mocked(splunkService.getIncidentLogs).mockResolvedValue([
      { timestamp: '', source: '', message: 'Error 1', severity: 'error', serviceName: 'checkout-service' },
      { timestamp: '', source: '', message: 'Error 2', severity: 'error', serviceName: 'checkout-service' },
      { timestamp: '', source: '', message: 'Error 3', severity: 'error', serviceName: 'checkout-service' },
    ]);

    vi.mocked(splunkService.getDeploymentEvents).mockResolvedValue([
      { id: 'd1', serviceName: 'checkout-service', version: '2.4.1', deployedAt: '', commitSha: 'abc', prNumber: 482, status: 'completed' },
    ]);

    vi.mocked(splunkService.getServiceErrors).mockResolvedValue([
      { timestamp: '', source: '', message: 'Redis cache error', severity: 'error', serviceName: 'checkout-service' },
    ]);

    vi.mocked(githubService.getPullRequest).mockResolvedValue({
      number: 482,
      title: 'Update cache',
      url: 'https://github.com/company/checkout-service/pull/482',
      author: 'dev',
      mergedAt: '',
      files: [],
    });

    const result = await investigateIncident('inc-123');

    expect(result).toHaveProperty('rootCause');
    expect(result).toHaveProperty('suspectedPrNumber', 482);
    expect(result).toHaveProperty('suspectedPrUrl', 'https://github.com/company/checkout-service/pull/482');
    expect(result.confidenceScore).toBeGreaterThan(50);
  });

  it('should throw if incident not found', async () => {
    vi.mocked(prisma.incident.findUnique).mockResolvedValue(null);

    await expect(investigateIncident('nonexistent')).rejects.toThrow('Incident not found');
  });
});
