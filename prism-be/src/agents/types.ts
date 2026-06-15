/**
 * Shared types for the multi-agent investigation system.
 */

export type AgentName =
  | 'coordinator'
  | 'telemetry'
  | 'root-cause'
  | 'deployment'
  | 'pr-traceback'
  | 'remediation';

export type AgentStatus = 'waiting' | 'running' | 'completed' | 'error';

export interface AgentEvent {
  agent: AgentName;
  status: AgentStatus;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface AgentFinding {
  agent: AgentName;
  title: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  evidence?: unknown;
}

export interface InvestigationContext {
  incidentId: string;
  serviceName: string;
  severity: string;
  title: string;
  description: string;
  detectedAt: string;
}

export interface TelemetryFindings {
  logs: import('./telemetry/data-generators.js').LogEntry[];
  metrics: Record<string, import('./telemetry/data-generators.js').MetricDataPoint[]>;
  traces: import('./telemetry/data-generators.js').TraceSpan[];
  anomalies: string[];
  errorPatterns: { message: string; count: number; firstSeen: string }[];
}

export interface DeploymentFindings {
  recentDeployments: import('./telemetry/data-generators.js').DeploymentEvent[];
  suspectedDeployment: import('./telemetry/data-generators.js').DeploymentEvent | null;
  correlationScore: number;
  timelineAnalysis: string;
}

export interface DependencyFindings {
  dependencies: import('./telemetry/data-generators.js').ServiceDependency[];
  impactedServices: string[];
  cascadeRisk: 'low' | 'medium' | 'high';
  topology: string;
}

export interface PRTracebackFindings {
  suspectedPR: {
    number: number;
    url: string;
    title: string;
    author: string;
    mergedAt: string;
    changedFiles: number;
    riskScore: number;
  } | null;
  commitAnalysis: string;
  relatedPRs: { number: number; title: string; relevance: number }[];
}

export interface RootCauseFindings {
  rootCause: string;
  confidence: number;
  reasoning: string;
  contributingFactors: string[];
  timeline: { time: string; event: string }[];
}

export interface RemediationFindings {
  actions: { priority: number; action: string; risk: string; eta: string; automated: boolean }[];
  summary: string;
  rollbackRecommended: boolean;
  preventionMeasures: string[];
}

export interface FullInvestigationResult {
  context: InvestigationContext;
  telemetry: TelemetryFindings;
  deployment: DeploymentFindings;
  dependencies: DependencyFindings;
  prTraceback: PRTracebackFindings;
  rootCause: RootCauseFindings;
  remediation: RemediationFindings;
  overallConfidence: number;
  summary: string;
  githubIssueUrl?: string;
}

export type EventEmitter = (event: AgentEvent) => void;
