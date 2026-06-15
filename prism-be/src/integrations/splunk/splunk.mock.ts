export interface SplunkLogEntry {
  timestamp: string;
  source: string;
  message: string;
  severity: string;
  serviceName: string;
}

export interface DeploymentEvent {
  id: string;
  serviceName: string;
  version: string;
  deployedAt: string;
  commitSha: string;
  prNumber: number;
  status: string;
}

export interface SplunkIncident {
  id: string;
  title: string;
  description: string;
  severity: string;
  serviceName: string;
  status: string;
  confidenceScore: number;
  detectedAt: string;
}
