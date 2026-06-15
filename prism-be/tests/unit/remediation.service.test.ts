import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRemediation, createRemediationPR } from '../../src/services/remediation/remediation.service.js';

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: {
    incident: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    investigation: {
      findFirst: vi.fn(),
    },
    remediation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    repository: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../src/integrations/github/github.service.js', () => ({
  githubService: {
    createBranch: vi.fn(),
    createPullRequest: vi.fn(),
    assignReviewers: vi.fn(),
  },
}));

import { prisma } from '../../src/utils/prisma.js';
import { githubService } from '../../src/integrations/github/github.service.js';

describe('Remediation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateRemediation', () => {
    it('should generate a remediation suggestion', async () => {
      const mockIncident = {
        id: 'inc-123',
        title: 'Redis Memory Leak',
        serviceName: 'checkout-service',
      };

      const mockInvestigation = {
        rootCause: 'Redis cache bug',
        suspectedPrNumber: 482,
        confidenceScore: 92,
      };

      vi.mocked(prisma.incident.findUnique).mockResolvedValue(mockIncident as any);
      vi.mocked(prisma.investigation.findFirst).mockResolvedValue(mockInvestigation as any);
      vi.mocked(prisma.remediation.create).mockResolvedValue({} as any);

      const result = await generateRemediation('inc-123');

      expect(result).toHaveProperty('branchName');
      expect(result.branchName).toContain('fix/incident-482');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('confidenceScore');
    });

    it('should throw if incident not found', async () => {
      vi.mocked(prisma.incident.findUnique).mockResolvedValue(null);

      await expect(generateRemediation('nonexistent')).rejects.toThrow('Incident not found');
    });
  });

  describe('createRemediationPR', () => {
    it('should create a PR and assign reviewers', async () => {
      const mockIncident = {
        id: 'inc-123',
        title: 'Redis Memory Leak',
        serviceName: 'checkout-service',
      };

      const mockRemediation = {
        id: 'rem-1',
        incidentId: 'inc-123',
        branchName: 'fix/incident-482-redis-memory-leak',
        status: 'pending',
      };

      const mockRepo = {
        githubUrl: 'https://github.com/company/checkout-service',
        defaultBranch: 'main',
      };

      vi.mocked(prisma.incident.findUnique).mockResolvedValue(mockIncident as any);
      vi.mocked(prisma.remediation.findFirst).mockResolvedValue(mockRemediation as any);
      vi.mocked(prisma.repository.findFirst).mockResolvedValue(mockRepo as any);
      vi.mocked(prisma.remediation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.incident.update).mockResolvedValue({} as any);

      vi.mocked(githubService.createBranch).mockResolvedValue({ ref: 'refs/heads/fix', sha: 'abc' });
      vi.mocked(githubService.createPullRequest).mockResolvedValue({
        number: 501,
        url: 'https://github.com/company/checkout-service/pull/501',
        title: 'fix',
        state: 'open',
        createdAt: '',
      });
      vi.mocked(githubService.assignReviewers).mockResolvedValue({ reviewers: ['Sarah Chen'] });

      const result = await createRemediationPR('inc-123');

      expect(result).toHaveProperty('prUrl');
      expect(result).toHaveProperty('reviewers');
      expect(result.reviewers.length).toBeGreaterThan(0);
    });

    it('should throw if no pending remediation exists', async () => {
      vi.mocked(prisma.incident.findUnique).mockResolvedValue({ id: 'inc-123' } as any);
      vi.mocked(prisma.remediation.findFirst).mockResolvedValue(null);

      await expect(createRemediationPR('inc-123')).rejects.toThrow('No pending remediation found');
    });
  });
});
