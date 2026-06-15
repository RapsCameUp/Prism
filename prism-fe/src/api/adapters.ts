/**
 * Adapters to convert backend API responses into the shapes expected by the frontend UI.
 * The UI was built with rich mock data structures; these adapters bridge the gap
 * while preserving mock-like fallback data for fields the backend doesn't yet provide.
 */

import type { Severity, IncidentStatus, Incident } from "@/lib/types";
import type { InvestigationMetadata } from "@/api/client";

// Backend response type for incidents
export interface BackendIncident {
  id: string;
  title: string;
  description: string;
  severity: string;
  serviceName: string;
  status: string;
  confidenceScore: number | null;
  githubIssueUrl: string | null;
  source: string | null;
  predictedAt: string | null;
  failureWindowMinutes: number | null;
  detectedAt: string;
  createdAt: string;
}

// Backend response type for repositories
export interface BackendRepository {
  id: string;
  name: string;
  serviceName: string;
  githubUrl: string;
  defaultBranch: string;
  environment: string;
  isActive: boolean;
  createdAt: string;
}

// Backend response type for investigation
export interface BackendInvestigation {
  id: string;
  incidentId: string;
  summary: string;
  rootCause: string;
  suspectedPrNumber: number | null;
  suspectedPrUrl: string | null;
  confidenceScore: number;
  metadata: InvestigationMetadata | null;
  createdAt: string;
}

// Map backend status to frontend IncidentStatus
function mapStatus(status: string): IncidentStatus {
  const map: Record<string, IncidentStatus> = {
    open: "open",
    investigating: "investigating",
    resolved: "resolved",
    closed: "resolved",
    mitigated: "mitigated",
    monitoring: "monitoring",
  };
  return map[status] || "open";
}

// Map backend severity to frontend Severity
function mapSeverity(severity: string): Severity {
  if (["critical", "high", "medium", "low"].includes(severity)) {
    return severity as Severity;
  }
  return "medium";
}

// Calculate duration from detectedAt to now
function calcDuration(detectedAt: string): string {
  const ms = Date.now() - new Date(detectedAt).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Convert a backend incident to the rich Incident interface expected by the UI.
 * Fields the backend doesn't provide get sensible defaults.
 */
export function adaptIncident(raw: BackendIncident): Incident {
  const severity = mapSeverity(raw.severity);
  const status = mapStatus(raw.status);
  const confidence = raw.confidenceScore ?? 0;
  const isPredicted = raw.source === 'cdtsm-prediction';

  return {
    id: raw.id,
    code: isPredicted ? `PRED-${raw.id.slice(-4).toUpperCase()}` : `INC-${raw.id.slice(-4).toUpperCase()}`,
    title: raw.title,
    service: raw.serviceName,
    severity,
    status,
    startedAt: raw.detectedAt,
    duration: calcDuration(raw.detectedAt),
    confidence,
    progress: Math.min(confidence, 100),
    region: "us-east-1",
    errorRate: `${(Math.random() * 5 + 0.5).toFixed(1)}%`,
    description: raw.description,
    githubIssueUrl: raw.githubIssueUrl ?? null,
    isPredicted,
    failureWindowMinutes: raw.failureWindowMinutes,
    suspectedPR: {
      number: 0,
      title: "Pending investigation",
      author: "unknown",
      repo: raw.serviceName,
      deployedAt: raw.detectedAt,
      confidence: 0,
      url: "#",
      changedFiles: [],
      diff: "",
    },
    aiTimeline: [
      { agent: "PRISM-Core", action: "Detected anomaly", detail: raw.title, time: "0s", status: "complete" },
    ],
    logs: [],
    traces: [],
    dependencyGraph: {
      nodes: [
        { id: raw.serviceName, label: raw.serviceName, type: "service" as const, impacted: true, root: true },
      ],
      edges: [],
    },
    rootCause: { summary: "Pending investigation", bullets: [] },
  };
}

/**
 * Enrich an adapted incident with investigation data.
 */
export function enrichWithInvestigation(incident: Incident, investigation: BackendInvestigation): Incident {
  const metadata = investigation.metadata;
  const prAuthor = metadata?.prTraceback?.suspectedPR?.author || 'unknown';
  const prTitle = metadata?.prTraceback?.suspectedPR?.title || investigation.rootCause;
  const prRiskScore = metadata?.prTraceback?.suspectedPR?.riskScore ?? investigation.confidenceScore;
  const prChangedFiles = metadata?.prTraceback?.changedFileNames || [];
  const prDiff = metadata?.prTraceback?.diff || '';

  return {
    ...incident,
    confidence: investigation.confidenceScore,
    progress: Math.min(investigation.confidenceScore, 100),
    suspectedPR: {
      ...incident.suspectedPR,
      number: investigation.suspectedPrNumber ?? 0,
      title: prTitle,
      author: prAuthor,
      confidence: prRiskScore,
      url: investigation.suspectedPrUrl ?? "#",
      changedFiles: prChangedFiles.length > 0 ? prChangedFiles : incident.suspectedPR.changedFiles,
      diff: prDiff,
    },
    rootCause: {
      summary: investigation.rootCause,
      bullets: [investigation.summary],
    },
  };
}

// Frontend repository display type
export interface FrontendRepository {
  name: string;
  language: string;
  env: string;
  status: "connected" | "degraded";
  lastSync: string;
  incidents: number;
  id: string;
  serviceName: string;
  githubUrl: string;
  defaultBranch: string;
}

export function adaptRepository(raw: BackendRepository): FrontendRepository {
  const syncAgo = Math.floor((Date.now() - new Date(raw.createdAt).getTime()) / 60000);
  const lastSync = syncAgo < 60 ? `${syncAgo}m ago` : syncAgo < 1440 ? `${Math.floor(syncAgo / 60)}h ago` : `${Math.floor(syncAgo / 1440)}d ago`;

  return {
    id: raw.id,
    name: raw.name,
    serviceName: raw.serviceName,
    githubUrl: raw.githubUrl,
    defaultBranch: raw.defaultBranch,
    language: "TypeScript",
    env: raw.environment,
    status: raw.isActive ? "connected" : "degraded",
    lastSync,
    incidents: 0,
  };
}
