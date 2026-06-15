import axios from 'axios';
import https from 'node:https';
import { env } from '../../config/env.js';
import type { SplunkLogEntry, DeploymentEvent, SplunkIncident } from './splunk.mock.js';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function parseIncidentRaw(raw: string): SplunkIncident | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length < 9) return null;

  // Parse from the end (safe even if description contains commas)
  const detectedAt = parts[parts.length - 1];
  const confidenceScore = parseInt(parts[parts.length - 2], 10);
  const status = parts[parts.length - 3];
  const serviceName = parts[parts.length - 4];
  const severity = parts[parts.length - 5];

  // First fields: _time, id, title
  const id = parts[1];
  const title = parts[2];

  // Description is everything between title and severity
  const description = parts.slice(3, parts.length - 5).join(',');

  return { id, title, description, severity, serviceName, status, confidenceScore, detectedAt };
}

/**
 * Parse _raw CSV field from Splunk application logs.
 * CSV format: _time,serviceName,level,source,message,host,region
 */
function parseLogRaw(raw: string, serviceName: string): SplunkLogEntry | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length < 7) return null;

  return {
    timestamp: parts[0],
    serviceName: parts[1] || serviceName,
    severity: parts[2] || 'ERROR',
    source: parts[3] || 'application',
    message: parts.slice(4, parts.length - 2).join(','),
  };
}

/**
 * Parse _raw CSV field from Splunk deployment events.
 * CSV format: _time,serviceName,version,previousVersion,deployedBy,commitSha,prNumber,environment,status,changedFiles,rollbackAvailable
 */
function parseDeploymentRaw(raw: string, serviceName: string): DeploymentEvent | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length < 11) return null;

  return {
    id: `deploy-${parts[5]?.slice(0, 8)}`,
    serviceName: parts[1] || serviceName,
    version: parts[2] || '',
    deployedAt: parts[0] || '',
    commitSha: parts[5] || '',
    prNumber: parseInt(parts[6] || '0', 10),
    status: parts[8] || 'success',
  };
}

export class SplunkService {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor() {
    this.baseUrl = env.SPLUNK_BASE_URL || 'https://localhost:8089';
    this.username = env.SPLUNK_USERNAME || 'admin';
    this.password = env.SPLUNK_PASSWORD || 'changeme';
  }

  /**
   * Run a oneshot SPL search against Splunk REST API and return results as JSON.
   */
  private async runQuery<T>(spl: string): Promise<T[]> {
    const response = await axios.post(
      `${this.baseUrl}/services/search/jobs/export`,
      new URLSearchParams({
        search: `search ${spl}`,
        output_mode: 'json',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: this.username,
          password: this.password,
        },
        httpsAgent,
        timeout: 60000,
      }
    );

    // Splunk export returns newline-delimited JSON objects
    // Each line is { "result": { ...fields... } } or { "preview": false, ... }
    const raw = response.data;
    const results: T[] = [];

    if (typeof raw === 'string') {
      const lines = raw.split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result) {
            results.push(parsed.result as T);
          }
        } catch { /* skip malformed lines */ }
      }
    } else if (Array.isArray(raw)) {
      return raw;
    }

    return results;
  }

  async search(query: string): Promise<unknown[]> {
    return this.runQuery<unknown>(query);
  }

  async getIncidentLogs(serviceName: string): Promise<SplunkLogEntry[]> {
    const results = await this.runQuery<Record<string, string>>(
      `index=main serviceName="${serviceName}" level=ERROR | head 50`
    );
    return results
      .map(r => {
        // Try extracted fields first, fall back to parsing _raw
        if (r.message && r.serviceName) {
          return {
            timestamp: r._time || r.timestamp || '',
            source: r.source || 'application',
            message: r.message,
            severity: r.level || r.severity || 'ERROR',
            serviceName: r.serviceName || serviceName,
          };
        }
        return parseLogRaw(r._raw, serviceName);
      })
      .filter((r): r is SplunkLogEntry => r !== null);
  }

  async getDeploymentEvents(serviceName: string): Promise<DeploymentEvent[]> {
    const results = await this.runQuery<Record<string, string>>(
      `index=deployments serviceName="${serviceName}" | sort -_time | head 10`
    );
    return results
      .map(r => {
        if (r.version && r.serviceName) {
          return {
            id: r.id || `deploy-${(r.commitSha || '').slice(0, 8)}`,
            serviceName: r.serviceName || serviceName,
            version: r.version || '',
            deployedAt: r._time || r.deployedAt || '',
            commitSha: r.commitSha || '',
            prNumber: parseInt(r.prNumber || '0', 10),
            status: r.status || 'success',
          };
        }
        return parseDeploymentRaw(r._raw, serviceName);
      })
      .filter((r): r is DeploymentEvent => r !== null);
  }

  async getServiceErrors(serviceName: string): Promise<SplunkLogEntry[]> {
    const results = await this.runQuery<Record<string, string>>(
      `index=main serviceName="${serviceName}" level=ERROR | stats count by message | sort -count | head 20`
    );
    // stats command produces extracted fields (message, count), no need for _raw parsing
    return results.map(r => ({
      timestamp: new Date().toISOString(),
      source: 'application',
      message: r.message || '',
      severity: 'ERROR',
      serviceName,
    }));
  }

  async getIncidents(): Promise<SplunkIncident[]> {
    const results = await this.runQuery<Record<string, string>>(
      `index=incidents | sort -_time | head 50`
    );
    console.log('[Splunk] Total raw results:', results.length);

    const incidents = results
      .map(r => {
        // Try extracted fields first
        if (r.title && r.serviceName) {
          return {
            id: r.id || '',
            title: r.title,
            description: r.description || '',
            severity: r.severity || 'medium',
            serviceName: r.serviceName,
            status: r.status || 'open',
            confidenceScore: parseInt(r.confidenceScore || '0', 10),
            detectedAt: r.detectedAt || r._time || '',
          };
        }
        // Fall back to parsing _raw CSV
        return parseIncidentRaw(r._raw);
      })
      .filter((r): r is SplunkIncident => r !== null);

    console.log('[Splunk] Parsed incidents:', incidents.length, incidents.map(i => `${i.id}: ${i.title}`));
    return incidents;
  }

  async getIncidentById(incidentId: string): Promise<SplunkIncident | null> {
    // Use full-text search to find the incident by ID in _raw
    console.log(`[Splunk] getIncidentById: searching for "${incidentId}"`);
    const results = await this.runQuery<Record<string, string>>(
      `index=incidents "${incidentId}" | head 1`
    );
    console.log(`[Splunk] getIncidentById results:`, results.length, results[0]?._raw?.substring(0, 80));

    // If full-text search failed, try searching all and filtering locally
    if (results.length === 0) {
      console.log(`[Splunk] Full-text search failed, fetching all incidents and filtering`);
      const allIncidents = await this.getIncidents();
      return allIncidents.find(inc => inc.id === incidentId) || null;
    }

    const r = results[0];
    if (r.title && r.serviceName) {
      return {
        id: r.id || incidentId,
        title: r.title,
        description: r.description || '',
        severity: r.severity || 'medium',
        serviceName: r.serviceName,
        status: r.status || 'open',
        confidenceScore: parseInt(r.confidenceScore || '0', 10),
        detectedAt: r.detectedAt || r._time || '',
      };
    }
    return parseIncidentRaw(r._raw);
  }
}

export const splunkService = new SplunkService();
