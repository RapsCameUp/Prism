// Mock operational data for PRISM
export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "investigating" | "mitigated" | "resolved" | "monitoring";

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
  logs: Array<{ time: string; level: "ERROR" | "WARN" | "INFO"; svc: string; msg: string }>;
  traces: Array<{ id: string; svc: string; duration: number; status: "ok" | "err" }>;
  dependencyGraph: {
    nodes: Array<{ id: string; label: string; type: "service" | "db" | "api" | "cache"; impacted: boolean; root?: boolean }>;
    edges: Array<{ from: string; to: string }>;
  };
  rootCause: { summary: string; bullets: string[] };
}

export const incidents: Incident[] = [
  {
    id: "inc-2041",
    code: "INC-2041",
    title: "Redis cache memory leak — checkout-service",
    service: "checkout-service",
    severity: "critical",
    status: "investigating",
    startedAt: "2026-05-28T14:32:11Z",
    duration: "00:18:42",
    confidence: 92,
    progress: 78,
    region: "us-east-1",
    errorRate: "12.4%",
    description:
      "Cache eviction policy regression causing unbounded growth in Redis working set. p99 checkout latency degraded from 240ms → 3.8s.",
    suspectedPR: {
      number: 482,
      title: "Redis cache invalidation refactor",
      author: "j-nakamura",
      repo: "company/checkout-service",
      deployedAt: "2026-05-28T13:58:02Z",
      confidence: 92,
      url: "https://github.com/company/checkout-service/pull/482",
      changedFiles: [
        "src/cache/redis-client.ts",
        "src/cache/invalidation.ts",
        "src/services/cart.service.ts",
        "tests/cache.spec.ts",
      ],
      diff: `--- a/src/cache/invalidation.ts
+++ b/src/cache/invalidation.ts
@@ -42,11 +42,8 @@ export class CacheInvalidator {
   async invalidate(key: string) {
-    const keys = await this.redis.scan(\`cart:\${key}:*\`);
-    if (keys.length) {
-      await this.redis.del(...keys);
-    }
+    // perf: defer cleanup to background job
+    this.queue.push({ key, ts: Date.now() });
     return true;
   }`,
    },
    aiTimeline: [
      { agent: "Telemetry Agent", action: "Correlated traces", detail: "1.2M spans · 4 services · anomaly t-12m", time: "14:33:02", status: "complete" },
      { agent: "Root Cause Agent", action: "Cross-referenced deploys", detail: "3 candidate deploys → checkout-service v4.18.2", time: "14:34:17", status: "complete" },
      { agent: "PR Traceback Agent", action: "Identified suspicious PR", detail: "PR #482 — 92% confidence", time: "14:35:44", status: "complete" },
      { agent: "Patch Agent", action: "Generating remediation", detail: "Drafting revert + bounded queue fix", time: "14:38:01", status: "running" },
      { agent: "Validation Agent", action: "Awaiting patch", detail: "Will run regression suite on draft", time: "—", status: "queued" },
    ],
    logs: [
      { time: "14:32:11", level: "ERROR", svc: "checkout", msg: "Redis OOM: maxmemory 4gb exceeded, evicting" },
      { time: "14:32:13", level: "WARN", svc: "checkout", msg: "Cart cache miss ratio 71% (baseline 4%)" },
      { time: "14:32:14", level: "ERROR", svc: "payments", msg: "Upstream timeout: checkout-service /cart/finalize" },
      { time: "14:32:18", level: "ERROR", svc: "checkout", msg: "CacheInvalidator queue depth 18420 (threshold 500)" },
      { time: "14:32:22", level: "INFO", svc: "k8s", msg: "Pod checkout-7d9 memory at 94%, scheduling restart" },
      { time: "14:32:30", level: "ERROR", svc: "checkout", msg: "Connection pool exhausted: 200/200" },
    ],
    traces: [
      { id: "t-a91f", svc: "POST /cart/finalize", duration: 3824, status: "err" },
      { id: "t-b203", svc: "GET /cart/:id", duration: 2104, status: "err" },
      { id: "t-c441", svc: "redis.GET cart:*", duration: 1890, status: "err" },
      { id: "t-d772", svc: "payments.charge", duration: 412, status: "ok" },
      { id: "t-e018", svc: "POST /cart/finalize", duration: 3650, status: "err" },
    ],
    dependencyGraph: {
      nodes: [
        { id: "edge", label: "Edge Gateway", type: "api", impacted: true },
        { id: "checkout", label: "checkout-service", type: "service", impacted: true, root: true },
        { id: "redis", label: "Redis Cluster", type: "cache", impacted: true },
        { id: "payments", label: "payments-service", type: "service", impacted: true },
        { id: "cart-db", label: "cart-db (Postgres)", type: "db", impacted: false },
        { id: "auth", label: "auth-service", type: "service", impacted: false },
        { id: "inventory", label: "inventory-service", type: "service", impacted: false },
      ],
      edges: [
        { from: "edge", to: "checkout" },
        { from: "checkout", to: "redis" },
        { from: "checkout", to: "cart-db" },
        { from: "checkout", to: "payments" },
        { from: "edge", to: "auth" },
        { from: "checkout", to: "inventory" },
      ],
    },
    rootCause: {
      summary:
        "PR #482 replaced synchronous cache invalidation with a background queue that has no bounded size or drain SLO. Under peak traffic the queue grows faster than it drains, Redis fills, and evictions cascade into cart misses and payment timeouts.",
      bullets: [
        "Invalidation queue is unbounded — no max length or backpressure",
        "Drain worker runs at 50 ops/s; observed ingest is ~600 ops/s",
        "Redis maxmemory-policy is noeviction → OOM errors instead of LRU",
        "No alert on queue depth; incident only surfaced via downstream payment timeouts",
      ],
    },
  },
  {
    id: "inc-2039",
    code: "INC-2039",
    title: "API timeout spike — auth-service /token endpoint",
    service: "auth-service",
    severity: "high",
    status: "mitigated",
    startedAt: "2026-05-28T11:04:00Z",
    duration: "00:42:11",
    confidence: 87,
    progress: 100,
    region: "eu-west-1",
    errorRate: "6.1%",
    description: "JWT validation hot path regressed after dependency bump.",
    suspectedPR: {
      number: 311,
      title: "Bump jose to 5.2.0",
      author: "p-patel",
      repo: "company/auth-service",
      deployedAt: "2026-05-28T10:51:00Z",
      confidence: 87,
      url: "https://github.com/company/auth-service/pull/311",
      changedFiles: ["package.json", "src/jwt/verify.ts"],
      diff: `- import { jwtVerify } from "jose"
+ import { jwtVerify } from "jose" // v5 — different default alg`,
    },
    aiTimeline: [
      { agent: "Telemetry Agent", action: "Detected p99 anomaly", detail: "/token p99 230ms → 1.8s", time: "11:04:14", status: "complete" },
      { agent: "Root Cause Agent", action: "Bisected deploys", detail: "auth-service @ 11:01 deploy", time: "11:05:21", status: "complete" },
      { agent: "PR Traceback Agent", action: "Identified PR #311", detail: "87% confidence", time: "11:06:02", status: "complete" },
      { agent: "Patch Agent", action: "Patch generated", detail: "Pinned jose@4.15.5 + alg whitelist", time: "11:09:50", status: "complete" },
      { agent: "Validation Agent", action: "Suite passed", detail: "412 tests · 0 regressions", time: "11:14:02", status: "complete" },
    ],
    logs: [
      { time: "11:04:00", level: "WARN", svc: "auth", msg: "/token latency p99 1840ms" },
      { time: "11:04:09", level: "ERROR", svc: "auth", msg: "jwtVerify: alg mismatch fallback" },
    ],
    traces: [{ id: "t-x01", svc: "POST /token", duration: 1840, status: "err" }],
    dependencyGraph: {
      nodes: [
        { id: "edge", label: "Edge Gateway", type: "api", impacted: true },
        { id: "auth", label: "auth-service", type: "service", impacted: true, root: true },
        { id: "user-db", label: "user-db", type: "db", impacted: false },
      ],
      edges: [{ from: "edge", to: "auth" }, { from: "auth", to: "user-db" }],
    },
    rootCause: { summary: "Major version bump of `jose` changed default signing algorithm handling.", bullets: ["Fallback path adds 1.6s", "No version pin"] },
  },
  {
    id: "inc-2037",
    code: "INC-2037",
    title: "Kubernetes node saturation — prod-cluster-a",
    service: "platform",
    severity: "high",
    status: "investigating",
    startedAt: "2026-05-28T09:21:00Z",
    duration: "02:11:00",
    confidence: 74,
    progress: 52,
    region: "us-east-1",
    errorRate: "2.8%",
    description: "Three nodes pinned at >95% CPU; HPA fighting itself.",
    suspectedPR: {
      number: 88,
      title: "Increase replica request CPU to 2 cores",
      author: "s-chen",
      repo: "company/platform-infra",
      deployedAt: "2026-05-28T08:42:00Z",
      confidence: 74,
      url: "https://github.com/company/platform-infra/pull/88",
      changedFiles: ["k8s/checkout/deployment.yaml", "k8s/payments/deployment.yaml"],
      diff: `-          cpu: "500m"
+          cpu: "2000m"`,
    },
    aiTimeline: [
      { agent: "Telemetry Agent", action: "Node pressure detected", detail: "3 nodes CPU>95%", time: "09:21:30", status: "complete" },
      { agent: "Root Cause Agent", action: "Correlating manifests", detail: "Request bump in platform-infra@88", time: "09:23:14", status: "complete" },
      { agent: "PR Traceback Agent", action: "Suspected PR #88", detail: "74% confidence", time: "09:25:02", status: "running" },
      { agent: "Patch Agent", action: "Waiting on traceback", detail: "—", time: "—", status: "queued" },
    ],
    logs: [{ time: "09:21:00", level: "WARN", svc: "k8s", msg: "node-a-7: cpu 96%" }],
    traces: [],
    dependencyGraph: {
      nodes: [
        { id: "k8s", label: "prod-cluster-a", type: "service", impacted: true, root: true },
        { id: "checkout", label: "checkout-service", type: "service", impacted: true },
        { id: "payments", label: "payments-service", type: "service", impacted: true },
      ],
      edges: [{ from: "k8s", to: "checkout" }, { from: "k8s", to: "payments" }],
    },
    rootCause: { summary: "CPU requests doubled without node capacity planning.", bullets: ["3 nodes saturated", "HPA scale-out blocked"] },
  },
  {
    id: "inc-2034",
    code: "INC-2034",
    title: "Authentication failure cascade — mobile clients",
    service: "auth-service",
    severity: "medium",
    status: "monitoring",
    startedAt: "2026-05-27T22:11:00Z",
    duration: "00:34:00",
    confidence: 81,
    progress: 100,
    region: "ap-south-1",
    errorRate: "1.2%",
    description: "Refresh token rotation race condition affecting iOS clients on slow networks.",
    suspectedPR: {
      number: 274,
      title: "Token rotation: single-use refresh",
      author: "m-jacobs",
      repo: "company/auth-service",
      deployedAt: "2026-05-27T21:40:00Z",
      confidence: 81,
      url: "https://github.com/company/auth-service/pull/274",
      changedFiles: ["src/tokens/refresh.ts", "src/tokens/rotation.ts"],
      diff: `- if (token.used) return reissue();
+ if (token.used) throw new ReuseError();`,
    },
    aiTimeline: [
      { agent: "Telemetry Agent", action: "Detected 401 spike", detail: "iOS clients only", time: "22:11:20", status: "complete" },
      { agent: "PR Traceback Agent", action: "PR #274 surfaced", detail: "81% confidence", time: "22:13:40", status: "complete" },
      { agent: "Patch Agent", action: "Patch generated", detail: "Grace window 5s for in-flight rotations", time: "22:18:00", status: "complete" },
    ],
    logs: [{ time: "22:11:00", level: "ERROR", svc: "auth", msg: "ReuseError: refresh token replay" }],
    traces: [],
    dependencyGraph: {
      nodes: [
        { id: "mobile", label: "Mobile API", type: "api", impacted: true },
        { id: "auth", label: "auth-service", type: "service", impacted: true, root: true },
      ],
      edges: [{ from: "mobile", to: "auth" }],
    },
    rootCause: { summary: "Single-use refresh tokens reject legitimate retries during network jitter.", bullets: ["Race on slow networks", "No grace window"] },
  },
];

export const repositories = [
  { name: "checkout-service", language: "TypeScript", env: "production", status: "connected", lastSync: "2m ago", incidents: 4 },
  { name: "auth-service", language: "Go", env: "production", status: "connected", lastSync: "5m ago", incidents: 2 },
  { name: "payments-service", language: "TypeScript", env: "production", status: "connected", lastSync: "1m ago", incidents: 1 },
  { name: "inventory-service", language: "Rust", env: "staging", status: "connected", lastSync: "11m ago", incidents: 0 },
  { name: "platform-infra", language: "Terraform", env: "production", status: "degraded", lastSync: "42m ago", incidents: 3 },
  { name: "notifications-service", language: "Python", env: "production", status: "connected", lastSync: "8m ago", incidents: 0 },
];

export const agents = [
  { name: "Incident Detection Agent", status: "active", tasks: 12, memory: 64, queries: 1842, processed: 314, confidence: 96, latency: 42 },
  { name: "Root Cause Agent", status: "active", tasks: 4, memory: 71, queries: 982, processed: 187, confidence: 89, latency: 318 },
  { name: "PR Traceback Agent", status: "active", tasks: 2, memory: 38, queries: 412, processed: 142, confidence: 91, latency: 614 },
  { name: "Patch Generation Agent", status: "active", tasks: 1, memory: 82, queries: 220, processed: 64, confidence: 84, latency: 2840 },
  { name: "Validation Agent", status: "idle", tasks: 0, memory: 12, queries: 88, processed: 58, confidence: 97, latency: 0 },
];

export const remediations = [
  {
    id: "rem-2041",
    incident: "INC-2041",
    title: "Bounded cache invalidation queue + revert path",
    repo: "company/checkout-service",
    branch: "fix/incident-2041-cache-bounded-queue",
    confidence: 91,
    status: "pending-approval" as const,
    summary: "Re-introduces synchronous invalidation under load with a bounded async fallback (max 500). Adds queue-depth alert.",
    reviewers: ["Sarah Chen", "Michael Jacobs", "Priya Patel"],
    files: 5,
    additions: 142,
    deletions: 38,
  },
  {
    id: "rem-2039",
    incident: "INC-2039",
    title: "Pin jose@4.15.5 and add algorithm allowlist",
    repo: "company/auth-service",
    branch: "fix/incident-2039-jose-pin",
    confidence: 96,
    status: "pending-approval" as const,
    summary: "Locks `jose` to last-known-good version and adds explicit alg allowlist to fail closed on unknown signatures.",
    reviewers: ["Priya Patel", "Marcus Liu"],
    files: 2,
    additions: 18,
    deletions: 4,
  },
  {
    id: "rem-2034",
    incident: "INC-2034",
    title: "5s grace window for refresh-token rotation",
    repo: "company/auth-service",
    branch: "fix/incident-2034-refresh-grace",
    confidence: 88,
    status: "approved" as const,
    summary: "Adds a short grace window allowing in-flight rotations to succeed on flaky mobile networks.",
    reviewers: ["Sarah Chen"],
    files: 3,
    additions: 47,
    deletions: 12,
  },
];

// Generate telemetry series
export const genSeries = (n = 48, base = 50, variance = 30) =>
  Array.from({ length: n }).map((_, i) => ({
    t: i,
    requests: Math.round(base + Math.sin(i / 4) * variance + Math.random() * 12),
    errors: Math.max(0, Math.round(Math.sin(i / 6) * 8 + Math.random() * 6)),
    latency: Math.round(120 + Math.sin(i / 5) * 40 + Math.random() * 30),
  }));

export const activityFeed = [
  { agent: "PR Traceback Agent", text: "Linked INC-2041 → PR #482 (checkout-service)", time: "just now" },
  { agent: "Patch Agent", text: "Drafted remediation for INC-2041", time: "32s ago" },
  { agent: "Telemetry Agent", text: "Anomaly: p99 spike on payments-service", time: "1m ago" },
  { agent: "Root Cause Agent", text: "Correlated 3 deploys for INC-2037", time: "2m ago" },
  { agent: "Validation Agent", text: "Regression suite passed for INC-2039 patch", time: "4m ago" },
  { agent: "Incident Detection Agent", text: "Opened INC-2041 (severity: critical)", time: "6m ago" },
  { agent: "PR Traceback Agent", text: "Scanned 47 PRs across 6 repos", time: "8m ago" },
];

export function getIncident(id: string) {
  return incidents.find((i) => i.id === id || i.code.toLowerCase() === id.toLowerCase());
}
