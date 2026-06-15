export interface MockPullRequest {
  number: number;
  title: string;
  url: string;
  author: string;
  mergedAt: string;
  files: string[];
}

export interface MockCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export function getMockPullRequest(owner: string, repo: string, prNumber: number): MockPullRequest {
  return {
    number: prNumber,
    title: `feat: update Redis cache invalidation logic (#${prNumber})`,
    url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
    author: 'developer-1',
    mergedAt: new Date(Date.now() - 7200000).toISOString(),
    files: ['src/cache/redis.ts', 'src/cache/invalidation.ts', 'src/config/redis.config.ts'],
  };
}

export function getMockCommit(sha: string): MockCommit {
  return {
    sha,
    message: 'feat: update Redis cache TTL and invalidation strategy',
    author: 'developer-1',
    date: new Date(Date.now() - 7200000).toISOString(),
  };
}

export function getMockCreatedBranch(branchName: string) {
  return {
    ref: `refs/heads/${branchName}`,
    sha: 'new-branch-sha-abc123',
  };
}

export function getMockCreatedPR(owner: string, repo: string, prNumber: number) {
  return {
    number: prNumber,
    url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
    title: `fix: resolve memory leak in Redis cache invalidation`,
    state: 'open',
    createdAt: new Date().toISOString(),
  };
}

export function getMockReviewers() {
  return ['Sarah Chen', 'Michael Jacobs', 'Priya Patel'];
}
