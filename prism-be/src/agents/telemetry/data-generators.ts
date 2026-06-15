/**
 * Realistic telemetry data generators for the agentic investigation system.
 * Simulates metrics, traces, and deployment data that agents use for correlation.
 */

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  labels: Record<string, string>;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  operationName: string;
  serviceName: string;
  duration: number;
  status: 'OK' | 'ERROR' | 'TIMEOUT';
  attributes: Record<string, string | number>;
  startTime: string;
}

export interface DeploymentEvent {
  id: string;
  serviceName: string;
  version: string;
  previousVersion: string;
  deployedAt: string;
  deployedBy: string;
  commitSha: string;
  prNumber: number;
  environment: string;
  status: 'success' | 'failed' | 'rolling_back';
  changedFiles: number;
  rollbackAvailable: boolean;
}

export interface ServiceDependency {
  source: string;
  target: string;
  protocol: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  requestsPerMinute: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, string | number>;
}

// Service topology - base relationships
const SERVICE_TOPOLOGY: ServiceDependency[] = [
  { source: 'checkout-service', target: 'payment-service', protocol: 'gRPC', avgLatencyMs: 45, p99LatencyMs: 180, errorRate: 0.001, requestsPerMinute: 1200 },
  { source: 'checkout-service', target: 'inventory-service', protocol: 'gRPC', avgLatencyMs: 23, p99LatencyMs: 95, errorRate: 0.0005, requestsPerMinute: 1200 },
  { source: 'checkout-service', target: 'auth-service', protocol: 'HTTP', avgLatencyMs: 12, p99LatencyMs: 50, errorRate: 0.0001, requestsPerMinute: 1200 },
  { source: 'payment-service', target: 'notification-service', protocol: 'async/kafka', avgLatencyMs: 89, p99LatencyMs: 340, errorRate: 0.002, requestsPerMinute: 800 },
  { source: 'auth-service', target: 'notification-service', protocol: 'async/kafka', avgLatencyMs: 120, p99LatencyMs: 450, errorRate: 0.003, requestsPerMinute: 200 },
  { source: 'inventory-service', target: 'notification-service', protocol: 'async/kafka', avgLatencyMs: 67, p99LatencyMs: 200, errorRate: 0.001, requestsPerMinute: 400 },
];

const RECENT_VERSIONS: Record<string, string[]> = {
  'auth-service': ['2.4.1', '2.4.0', '2.3.8', '2.3.7'],
  'checkout-service': ['3.1.2', '3.1.1', '3.1.0', '3.0.9'],
  'payment-service': ['1.8.5', '1.8.4', '1.8.3', '1.8.2'],
  'inventory-service': ['2.0.3', '2.0.2', '2.0.1', '2.0.0'],
  'notification-service': ['1.3.1', '1.3.0', '1.2.9', '1.2.8'],
};

const ERROR_PATTERNS: Record<string, string[]> = {
  'auth-service': [
    'JWT token validation failed: signature mismatch',
    'Redis session store connection timeout after 5000ms',
    'Rate limiter exceeded for IP range 10.0.x.x',
  ],
  'checkout-service': [
    'Transaction deadlock detected in order creation',
    'Inventory reservation timeout - downstream service unavailable',
    'Cart session expired during checkout flow',
  ],
  'payment-service': [
    'Connection pool exhausted: max 50 connections reached',
    'Stripe webhook signature verification failed',
    'Payment gateway timeout after 30000ms - circuit breaker OPEN',
  ],
  'inventory-service': [
    'Optimistic lock conflict on SKU reservation',
    'Database connection pool exhausted',
    'Cache invalidation storm detected - fallback to DB',
  ],
  'notification-service': [
    'Kafka consumer lag exceeding threshold: 5000 messages',
    'SMTP relay connection refused',
    'Template rendering error: undefined variable "userName"',
  ],
};

function randomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

/**
 * Generate realistic error logs for a service around the time of an incident.
 */
export function generateLogs(serviceName: string, severity: string): LogEntry[] {
  const errors = ERROR_PATTERNS[serviceName] || ERROR_PATTERNS['checkout-service'];
  const isCritical = severity === 'critical';
  const logCount = isCritical ? 25 + Math.floor(Math.random() * 20) : 8 + Math.floor(Math.random() * 10);
  const traceId = randomId() + randomId();

  const logs: LogEntry[] = [];
  for (let i = 0; i < logCount; i++) {
    const minutesBack = Math.floor(Math.random() * 45);
    logs.push({
      timestamp: minutesAgo(minutesBack),
      level: i < logCount * 0.7 ? 'ERROR' : 'WARN',
      service: serviceName,
      message: errors[Math.floor(Math.random() * errors.length)],
      traceId: `${traceId}${i % 5}`,
      spanId: randomId(),
      metadata: {
        host: `${serviceName}-pod-${Math.floor(Math.random() * 5) + 1}`,
        region: Math.random() > 0.5 ? 'us-east-1' : 'us-west-2',
        responseTime: Math.floor(Math.random() * 5000) + 200,
      },
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Generate time-series metrics for a service (error rate, latency, CPU, memory).
 */
export function generateMetrics(serviceName: string, severity: string): Record<string, MetricDataPoint[]> {
  const isCritical = severity === 'critical';
  const points = 30; // 30 data points over last 30 minutes

  const errorRate: MetricDataPoint[] = [];
  const latencyP99: MetricDataPoint[] = [];
  const cpuUsage: MetricDataPoint[] = [];
  const memoryUsage: MetricDataPoint[] = [];

  for (let i = 0; i < points; i++) {
    const ts = minutesAgo(points - i);
    const anomalyFactor = i > 20 ? (isCritical ? 5 : 2.5) : 1;

    errorRate.push({
      timestamp: ts,
      value: parseFloat(((0.001 + Math.random() * 0.002) * anomalyFactor).toFixed(4)),
      labels: { service: serviceName, type: 'http_5xx' },
    });

    latencyP99.push({
      timestamp: ts,
      value: Math.floor((45 + Math.random() * 30) * anomalyFactor),
      labels: { service: serviceName, percentile: '99' },
    });

    cpuUsage.push({
      timestamp: ts,
      value: parseFloat(((30 + Math.random() * 15) * (i > 22 ? 2.2 : 1)).toFixed(1)),
      labels: { service: serviceName, pod: `${serviceName}-pod-1` },
    });

    memoryUsage.push({
      timestamp: ts,
      value: parseFloat(((55 + Math.random() * 10) + (i > 15 ? i * 1.5 : 0)).toFixed(1)),
      labels: { service: serviceName, pod: `${serviceName}-pod-1` },
    });
  }

  return {
    'error_rate_5xx': errorRate,
    'latency_p99_ms': latencyP99,
    'cpu_usage_percent': cpuUsage,
    'memory_usage_percent': memoryUsage,
  };
}

/**
 * Generate distributed trace spans showing request flow across services.
 */
export function generateTraces(serviceName: string): TraceSpan[] {
  const traceId = randomId() + randomId() + randomId();
  const spans: TraceSpan[] = [];

  // Find downstream dependencies from this service
  const downstreams = SERVICE_TOPOLOGY.filter(d => d.source === serviceName);
  const upstreams = SERVICE_TOPOLOGY.filter(d => d.target === serviceName);

  // Root span - incoming request
  const rootSpanId = randomId();
  spans.push({
    traceId,
    spanId: rootSpanId,
    parentSpanId: null,
    operationName: `${serviceName}.handleRequest`,
    serviceName,
    duration: 250 + Math.floor(Math.random() * 2000),
    status: 'ERROR',
    attributes: { 'http.method': 'POST', 'http.status_code': 500, 'http.url': `/api/v1/${serviceName.replace('-service', '')}` },
    startTime: minutesAgo(5),
  });

  // Downstream calls
  for (const dep of downstreams) {
    const spanId = randomId();
    const isErrored = Math.random() > 0.6;
    spans.push({
      traceId,
      spanId,
      parentSpanId: rootSpanId,
      operationName: `${dep.target}.call`,
      serviceName: dep.target,
      duration: dep.avgLatencyMs + Math.floor(Math.random() * dep.p99LatencyMs),
      status: isErrored ? 'ERROR' : 'OK',
      attributes: { 'rpc.system': dep.protocol, 'peer.service': dep.target },
      startTime: minutesAgo(5),
    });

    // Nested span in downstream service
    if (isErrored) {
      spans.push({
        traceId,
        spanId: randomId(),
        parentSpanId: spanId,
        operationName: `${dep.target}.processRequest`,
        serviceName: dep.target,
        duration: dep.p99LatencyMs + Math.floor(Math.random() * 500),
        status: 'ERROR',
        attributes: { 'error.type': 'TimeoutException', 'error.message': 'Connection pool exhausted' },
        startTime: minutesAgo(5),
      });
    }
  }

  // Upstream callers
  for (const dep of upstreams) {
    spans.push({
      traceId,
      spanId: randomId(),
      parentSpanId: null,
      operationName: `${dep.source}.outboundCall`,
      serviceName: dep.source,
      duration: dep.avgLatencyMs + Math.floor(Math.random() * 100),
      status: 'OK',
      attributes: { 'peer.service': serviceName, 'rpc.system': dep.protocol },
      startTime: minutesAgo(6),
    });
  }

  return spans;
}

/**
 * Generate deployment events for a service and its neighbors.
 */
export function generateDeployments(serviceName: string): DeploymentEvent[] {
  const versions = RECENT_VERSIONS[serviceName] || RECENT_VERSIONS['checkout-service'];
  const deployments: DeploymentEvent[] = [];

  // Most recent deployment (the suspected cause)
  deployments.push({
    id: randomId(),
    serviceName,
    version: versions[0],
    previousVersion: versions[1],
    deployedAt: hoursAgo(2),
    deployedBy: 'ci/github-actions',
    commitSha: randomId() + randomId(),
    prNumber: 140 + Math.floor(Math.random() * 60),
    environment: 'production',
    status: 'success',
    changedFiles: 8 + Math.floor(Math.random() * 15),
    rollbackAvailable: true,
  });

  // Previous deployment
  deployments.push({
    id: randomId(),
    serviceName,
    version: versions[1],
    previousVersion: versions[2],
    deployedAt: hoursAgo(48),
    deployedBy: 'ci/github-actions',
    commitSha: randomId() + randomId(),
    prNumber: 130 + Math.floor(Math.random() * 10),
    environment: 'production',
    status: 'success',
    changedFiles: 3,
    rollbackAvailable: true,
  });

  // Neighboring service deployments
  const neighbors = SERVICE_TOPOLOGY
    .filter(d => d.source === serviceName || d.target === serviceName)
    .map(d => d.source === serviceName ? d.target : d.source);

  for (const neighbor of neighbors.slice(0, 2)) {
    const nVersions = RECENT_VERSIONS[neighbor] || versions;
    deployments.push({
      id: randomId(),
      serviceName: neighbor,
      version: nVersions[0],
      previousVersion: nVersions[1],
      deployedAt: hoursAgo(6 + Math.floor(Math.random() * 24)),
      deployedBy: 'ci/github-actions',
      commitSha: randomId() + randomId(),
      prNumber: 80 + Math.floor(Math.random() * 50),
      environment: 'production',
      status: 'success',
      changedFiles: 4,
      rollbackAvailable: true,
    });
  }

  return deployments;
}

/**
 * Discover service dependencies dynamically from trace data.
 */
export function discoverDependencies(serviceName: string): ServiceDependency[] {
  // Return all dependencies that involve this service + transitive deps
  const direct = SERVICE_TOPOLOGY.filter(
    d => d.source === serviceName || d.target === serviceName
  );

  // Add some transitive (2nd-hop) dependencies
  const neighbors = new Set(direct.map(d => d.source === serviceName ? d.target : d.source));
  const transitive = SERVICE_TOPOLOGY.filter(
    d => neighbors.has(d.source) && d.target !== serviceName
  );

  // Inject anomaly into error rates for affected dependencies
  return [...direct, ...transitive].map(dep => ({
    ...dep,
    errorRate: dep.target === serviceName || dep.source === serviceName
      ? dep.errorRate * (5 + Math.random() * 10) // Elevated error rate for affected service
      : dep.errorRate,
    avgLatencyMs: dep.target === serviceName
      ? dep.avgLatencyMs * (2 + Math.random() * 3) // Elevated latency
      : dep.avgLatencyMs,
  }));
}
