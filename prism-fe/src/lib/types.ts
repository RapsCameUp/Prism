// Shared UI types for PRISM
export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved" | "monitoring";

export interface Incident {
  id: string;
  code: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  duration: string;
  confidence: number;
  progress: number;
  region: string;
  errorRate: string;
  description: string;
  githubIssueUrl?: string | null;
  isPredicted: boolean;
  failureWindowMinutes?: number | null;
  suspectedPR: {
    number: number;
    title: string;
    author: string;
    repo: string;
    deployedAt: string;
    confidence: number;
    url: string;
    changedFiles: string[];
    diff: string;
  };
  aiTimeline: Array<{
    agent: string;
    action: string;
    detail: string;
    time: string;
    status: "complete" | "running" | "queued";
  }>;
  logs: Array<{ time: string; level: string; svc: string; msg: string }>;
  traces: Array<{ id: string; svc: string; duration: number; status: string }>;
  dependencyGraph: {
    nodes: Array<{ id: string; label: string; type: "service" | "db" | "api" | "cache"; impacted: boolean; root?: boolean }>;
    edges: Array<{ from: string; to: string }>;
  };
  rootCause: { summary: string; bullets: string[] };
}

// Generate synthetic telemetry chart series for UI visualizations
export const genSeries = (n = 48, base = 50, variance = 30) =>
  Array.from({ length: n }).map((_, i) => ({
    t: i,
    requests: Math.round(base + Math.sin(i / 4) * variance + Math.random() * 12),
    errors: Math.max(0, Math.round(Math.sin(i / 6) * 8 + Math.random() * 6)),
    latency: Math.round(120 + Math.sin(i / 5) * 40 + Math.random() * 30),
  }));
