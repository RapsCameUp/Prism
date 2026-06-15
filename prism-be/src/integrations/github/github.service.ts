import axios from 'axios';
import { env } from '../../config/env.js';

export class GitHubService {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.token = env.GITHUB_TOKEN;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async getPullRequest(owner: string, repo: string, prNumber: number) {
    const response = await axios.get(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers: this.headers }
    );
    return {
      number: response.data.number,
      title: response.data.title,
      url: response.data.html_url,
      author: response.data.user.login,
      mergedAt: response.data.merged_at,
      files: [],
    };
  }

  async getCommit(owner: string, repo: string, sha: string) {
    const response = await axios.get(
      `${this.baseUrl}/repos/${owner}/${repo}/commits/${sha}`,
      { headers: this.headers }
    );
    return {
      sha: response.data.sha,
      message: response.data.commit.message,
      author: response.data.commit.author.name,
      date: response.data.commit.author.date,
    };
  }

  async createBranch(owner: string, repo: string, branchName: string, fromBranch: string = 'main') {
    // Get the SHA of the base branch
    const refResponse = await axios.get(
      `${this.baseUrl}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`,
      { headers: this.headers }
    );
    const sha = refResponse.data.object.sha;

    // Create new branch
    const response = await axios.post(
      `${this.baseUrl}/repos/${owner}/${repo}/git/refs`,
      { ref: `refs/heads/${branchName}`, sha },
      { headers: this.headers }
    );
    return { ref: response.data.ref, sha: response.data.object.sha };
  }

  /**
   * Create or update a file on a branch (creates a commit).
   */
  async createFileOnBranch(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ) {
    const encodedContent = Buffer.from(content).toString('base64');
    const response = await axios.put(
      `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
      {
        message,
        content: encodedContent,
        branch,
      },
      { headers: this.headers }
    );
    return { sha: response.data.content.sha, path: response.data.content.path };
  }

  /**
   * Get the diff/files changed for a specific PR.
   */
  async getPullRequestDiff(owner: string, repo: string, prNumber: number) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
        { headers: this.headers }
      );
      return (response.data as Array<{ filename: string; status: string; patch?: string; additions: number; deletions: number }>).map(f => ({
        filename: f.filename,
        status: f.status,
        patch: f.patch || '',
        additions: f.additions,
        deletions: f.deletions,
      }));
    } catch {
      return [];
    }
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string = 'main',
    body: string = ''
  ) {
    const response = await axios.post(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls`,
      { title, head, base, body },
      { headers: this.headers }
    );
    return {
      number: response.data.number,
      url: response.data.html_url,
      title: response.data.title,
      state: response.data.state,
      createdAt: response.data.created_at,
    };
  }

  async assignReviewers(owner: string, repo: string, prNumber: number, reviewers: string[]) {
    await axios.post(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
      { reviewers },
      { headers: this.headers }
    );
    return { reviewers };
  }

  async createIssue(owner: string, repo: string, title: string, body: string, labels: string[] = []) {
    const response = await axios.post(
      `${this.baseUrl}/repos/${owner}/${repo}/issues`,
      { title, body, labels },
      { headers: this.headers }
    );
    return {
      number: response.data.number,
      url: response.data.html_url,
      title: response.data.title,
    };
  }
}

export const githubService = new GitHubService();
