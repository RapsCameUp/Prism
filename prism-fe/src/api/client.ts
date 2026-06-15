const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface InvestigationMetadata {
  telemetrySummary: {
    logCount: number;
    errorPatterns: { message: string; count: number; firstSeen: string }[];
    anomalies: string[];
    traceCount: number;
  };
  deployment: {
    suspectedDeployment: {
      version: string;
      deployedAt: string;
      deployedBy: string;
      changedFiles: number;
      prNumber: number;
    } | null;
    correlationScore: number;
    timelineAnalysis: string;
  };
  rootCauseDetails: {
    reasoning: string;
    contributingFactors: string[];
    timeline: { time: string; event: string }[];
  };
  dependencies: {
    impactedServices: string[];
    cascadeRisk: string;
  };
  remediation: {
    actions: { priority: number; action: string; risk: string; eta: string; automated: boolean }[];
    rollbackRecommended: boolean;
    preventionMeasures: string[];
  };
  prTraceback: {
    suspectedPR: { number: number; url: string; title: string; author: string; mergedAt: string; changedFiles: number; riskScore: number } | null;
    commitAnalysis: string;
    relatedPRs: { number: number; title: string; relevance: number }[];
    diff?: string;
    changedFileNames?: string[];
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    try {
      const stored = localStorage.getItem("prism-auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.token ?? null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    // Only set Content-Type for requests that have a body
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Clear auth state on unauthorized
      localStorage.removeItem("prism-auth");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
  }

  async getMe() {
    return this.request<{ id: string; name: string; email: string; role: string; createdAt: string }>(
      "/auth/me"
    );
  }

  // Repositories
  async getRepositories() {
    return this.request<Array<{
      id: string; name: string; serviceName: string; githubUrl: string;
      defaultBranch: string; environment: string; isActive: boolean; createdAt: string;
    }>>("/repositories");
  }

  async getRepository(id: string) {
    return this.request<{
      id: string; name: string; serviceName: string; githubUrl: string;
      defaultBranch: string; environment: string; isActive: boolean; createdAt: string;
    }>(`/repositories/${id}`);
  }

  async createRepository(data: { name: string; serviceName: string; githubUrl: string; defaultBranch?: string; environment?: string }) {
    return this.request("/repositories", { method: "POST", body: JSON.stringify(data) });
  }

  async updateRepository(id: string, data: Partial<{ name: string; serviceName: string; githubUrl: string; defaultBranch: string; environment: string; isActive: boolean }>) {
    return this.request(`/repositories/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteRepository(id: string) {
    return this.request(`/repositories/${id}`, { method: "DELETE" });
  }

  // Incidents
  async getIncidents() {
    return this.request<Array<{
      id: string; title: string; description: string; severity: string;
      serviceName: string; status: string; confidenceScore: number | null;
      githubIssueUrl: string | null; source: string | null;
      predictedAt: string | null; failureWindowMinutes: number | null;
      detectedAt: string; createdAt: string;
    }>>("/incidents");
  }

  async getIncident(id: string) {
    return this.request<{
      id: string; title: string; description: string; severity: string;
      serviceName: string; status: string; confidenceScore: number | null;
      githubIssueUrl: string | null; source: string | null;
      predictedAt: string | null; failureWindowMinutes: number | null;
      detectedAt: string; createdAt: string;
    }>(`/incidents/${id}`);
  }

  async createIncident(data: { title: string; description: string; severity: string; serviceName: string }) {
    return this.request("/incidents", { method: "POST", body: JSON.stringify(data) });
  }

  async updateIncident(id: string, data: Partial<{ title: string; description: string; severity: string; status: string }>) {
    return this.request(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  // Investigations
  async startInvestigation(incidentId: string) {
    return this.request<{
      summary: string; rootCause: string; suspectedPrNumber: number | null;
      suspectedPrUrl: string | null; confidenceScore: number;
    }>(`/investigations/${incidentId}/start`, { method: "POST" });
  }

  async getInvestigation(incidentId: string) {
    try {
      return await this.request<{
        id: string; incidentId: string; summary: string; rootCause: string;
        suspectedPrNumber: number | null; suspectedPrUrl: string | null;
        confidenceScore: number; metadata: InvestigationMetadata | null; createdAt: string;
      }>(`/investigations/${incidentId}`);
    } catch {
      return null;
    }
  }

  // Remediations
  async generateRemediation(incidentId: string) {
    return this.request<{ branchName: string; summary: string; confidenceScore: number }>(
      `/remediations/${incidentId}/generate`,
      { method: "POST" }
    );
  }

  async createRemediationPR(incidentId: string) {
    return this.request<{ prUrl: string; reviewers: string[] }>(
      `/remediations/${incidentId}/create-pr`,
      { method: "POST" }
    );
  }

  // Incident logs
  async getIncidentLogs(incidentId: string) {
    try {
      return await this.request<{
        logs: { time: string; level: string; svc: string; msg: string }[];
        traces: { id: string; svc: string; duration: number; status: string }[];
      }>(
        `/incidents/${incidentId}/logs`
      );
    } catch {
      return { logs: [], traces: [] };
    }
  }

  // Incident remediation status
  async getIncidentRemediation(incidentId: string) {
    try {
      return await this.request<{ exists: boolean; prUrl: string | null; status: string | null }>(
        `/incidents/${incidentId}/remediation`
      );
    } catch {
      return { exists: false, prUrl: null, status: null };
    }
  }

  // Ask AI about an incident
  async askIncidentQuestion(incidentId: string, question: string) {
    return this.request<{ answer: string }>(
      `/incidents/${incidentId}/ask`,
      { method: "POST", body: JSON.stringify({ question }) }
    );
  }

  // Health
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>("/health");
  }
}

export const api = new ApiClient(API_URL);
