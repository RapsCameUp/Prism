import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  GitPullRequest,
  AlertOctagon,
  Sparkles,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Activity,
  Search,
  Shield,
  Cpu,
  Network,
  AlertTriangle,
  BarChart3,
  Rocket,
  Wrench,
  MessageCircle,
  Send,
  Loader2,
} from "lucide-react";
import { type Incident } from "@/lib/types";
import { SeverityBadge, StatusBadge } from "@/components/prism/Badges";
import { TelemetryChart } from "@/components/prism/TelemetryChart";
import { ServiceDependencyGraph } from "@/components/prism/ServiceDependencyGraph";
import { genSeries } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RemediationProgressModal } from "@/components/prism/RemediationProgressModal";
import { InvestigationModal } from "@/components/prism/InvestigationModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIncident, useInvestigation, useGenerateRemediation, useCreateRemediationPR, useIncidentLogs, useIncidentRemediation, useAskIncidentQuestion } from "@/api/hooks";
import { adaptIncident, enrichWithInvestigation } from "@/api/adapters";
import type { InvestigationMetadata } from "@/api/client";

export const Route = createFileRoute("/_app/incidents/$id")({
  head: () => ({
    meta: [{ title: "Incident — PRISM" }],
  }),
  component: IncidentDetailsPage,
});

// Agent configuration for the collapsible AI investigation section
const AGENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  coordinator: { label: 'Incident Coordinator', icon: Cpu, color: 'text-violet-400' },
  telemetry: { label: 'Telemetry Agent', icon: Activity, color: 'text-blue-400' },
  deployment: { label: 'Deployment Agent', icon: GitBranch, color: 'text-orange-400' },
  'root-cause': { label: 'Root Cause Agent', icon: Search, color: 'text-yellow-400' },
  'pr-traceback': { label: 'PR Traceback Agent', icon: Network, color: 'text-cyan-400' },
  remediation: { label: 'Remediation Agent', icon: Shield, color: 'text-green-400' },
};

function IncidentDetailsPage() {
  const params = Route.useParams() as { id: string };
  const navigate = useNavigate();
  const [tab, setTab] = useState<"logs" | "traces">("logs");
  const [showProgress, setShowProgress] = useState(false);
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [showAskAiModal, setShowAskAiModal] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Load from backend
  const { data: backendIncident, isLoading, refetch } = useIncident(params.id);
  const { data: investigation } = useInvestigation(params.id);
  const { data: logsData } = useIncidentLogs(params.id);
  const { data: remediationStatus, refetch: refetchRemediation } = useIncidentRemediation(params.id);
  const generateRemediation = useGenerateRemediation();
  const createPR = useCreateRemediationPR();
  const askAi = useAskIncidentQuestion();

  // Build the incident object from backend data
  let inc: Incident | null = null;
  if (backendIncident) {
    inc = adaptIncident(backendIncident);
    if (investigation) {
      inc = enrichWithInvestigation(inc, investigation);
    }
    // Populate logs from Splunk
    if (logsData?.logs && logsData.logs.length > 0) {
      inc = { ...inc, logs: logsData.logs };
    }
    // Populate traces
    if (logsData?.traces && logsData.traces.length > 0) {
      inc = { ...inc, traces: logsData.traces };
    }
  }

  if (!inc) {
    if (isLoading) {
      return <div className="p-6 text-muted-foreground">Loading incident...</div>;
    }
    return <div className="p-6 text-muted-foreground">Incident not found</div>;
  }

  const series = genSeries(48, 80, 50);
  const metadata: InvestigationMetadata | null = investigation?.metadata ?? null;

  const generateFix = () => {
    if (backendIncident) {
      generateRemediation.mutate(params.id, {
        onSuccess: (data) => {
          toast.success("Remediation generated", { description: `Branch: ${data.branchName}` });
          setShowProgress(true);
          createPR.mutate(params.id, {
            onSuccess: (prData) => {
              toast.success("Pull request created", { description: prData.prUrl });
              refetchRemediation();
            },
            onError: (err) => toast.error("Failed to create PR", { description: err.message }),
          });
        },
        onError: () => toast.error("Failed to generate remediation"),
      });
    }
  };

  // Build agent activities from metadata for the collapsible cards
  const agentActivities = buildAgentActivities(metadata);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <button onClick={() => navigate({ to: "/incidents" })} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Incidents
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-foreground">{inc.code}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={inc.severity} />
            <StatusBadge status={inc.status} />
            <span className="text-[11px] font-mono text-muted-foreground">started {inc.startedAt.replace("T", " ").replace("Z", " UTC")}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{inc.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{inc.description}</p>
          <div className="flex items-center gap-2 mt-3">
            {inc.status === "open" && !investigation && (
              <button
                onClick={() => setShowInvestigationModal(true)}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors glow-green inline-flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Investigate
              </button>
            )}
            {/* GitHub issue link */}
            {inc.githubIssueUrl && (
              <a
                href={inc.githubIssueUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-2/80 transition-colors inline-flex items-center gap-2 text-foreground"
              >
                <GitBranch className="h-4 w-4" />
                View GitHub Issue
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: "duration", v: inc.duration, mono: true },
            { l: "err rate", v: inc.errorRate, c: "text-critical" },
            { l: "confidence", v: `${inc.confidence}%`, c: "text-primary" },
          ].map((s) => (
            <div key={s.l} className="rounded-md border border-border bg-surface-2/60 px-3 py-2 min-w-[88px]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.l}</div>
              <div className={cn("text-base font-semibold tabular-nums mt-0.5", s.c)}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT — telemetry, root cause, logs */}
        <div className="xl:col-span-2 space-y-4">
          {/* Telemetry */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium">Telemetry analysis</div>
                <div className="text-[11px] font-mono text-muted-foreground">{inc.service} · throughput & errors</div>
              </div>
              <span className="text-[10px] font-mono text-warning flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" /> anomaly detected
              </span>
            </div>
            <TelemetryChart data={series} height={200} />
          </section>

          {/* Telemetry Summary — from investigation metadata */}
          {metadata?.telemetrySummary && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                <div className="text-sm font-medium">Telemetry Summary</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border border-border bg-surface-2/40 p-2.5 text-center">
                  <div className="text-lg font-semibold text-critical">{metadata.telemetrySummary.logCount}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Error Logs</div>
                </div>
                <div className="rounded-md border border-border bg-surface-2/40 p-2.5 text-center">
                  <div className="text-lg font-semibold text-warning">{metadata.telemetrySummary.errorPatterns.length}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Error Patterns</div>
                </div>
                <div className="rounded-md border border-border bg-surface-2/40 p-2.5 text-center">
                  <div className="text-lg font-semibold text-orange-400">{metadata.telemetrySummary.anomalies.length}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Anomalies</div>
                </div>
                <div className="rounded-md border border-border bg-surface-2/40 p-2.5 text-center">
                  <div className="text-lg font-semibold text-info">{metadata.dependencies?.impactedServices?.length ?? 0}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Impacted Services</div>
                </div>
              </div>
              {metadata.telemetrySummary.anomalies.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Anomalies detected:</div>
                  {metadata.telemetrySummary.anomalies.map((a, i) => {
                    // Parse JSON anomaly strings if needed
                    let displayText = a;
                    try {
                      const parsed = JSON.parse(a);
                      displayText = parsed.analysis || parsed.message || a;
                    } catch { /* not JSON, use as-is */ }
                    return (
                      <div key={i} className="text-xs text-warning flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> <span>{displayText}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Deployment Correlation — from investigation metadata */}
          {metadata?.deployment && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="h-4 w-4 text-orange-400" />
                <div className="text-sm font-medium">Deployment Correlation</div>
                <span className="ml-auto text-[10px] font-mono text-primary">{metadata.deployment.correlationScore}% correlation</span>
              </div>
              {metadata.deployment.suspectedDeployment ? (
                <div className="rounded-md border border-border bg-surface-2/40 p-3 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">version</span>
                    <span className="text-foreground">v{metadata.deployment.suspectedDeployment.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">deployed at</span>
                    <span className="text-foreground">{metadata.deployment.suspectedDeployment.deployedAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">deployed by</span>
                    <span className="text-foreground">{metadata.deployment.suspectedDeployment.deployedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">files changed</span>
                    <span className="text-foreground">{metadata.deployment.suspectedDeployment.changedFiles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PR</span>
                    <span className="text-primary">#{metadata.deployment.suspectedDeployment.prNumber}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No recent deployment found</div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{metadata.deployment.timelineAnalysis}</p>
            </section>
          )}

          {/* Root cause */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="h-4 w-4 text-warning" />
              <div className="text-sm font-medium">Root cause analysis</div>
            </div>
            <p className="text-sm text-foreground/90">{inc.rootCause.summary}</p>
            {inc.rootCause.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {inc.rootCause.bullets.map((b) => (
                  <li key={b} className="text-[13px] flex gap-2 text-foreground/90">
                    <span className="text-primary mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {metadata?.rootCauseDetails && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Reasoning:</span> {metadata.rootCauseDetails.reasoning}</p>
                {(metadata.rootCauseDetails.contributingFactors ?? []).length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Contributing factors:</div>
                    <ul className="space-y-1">
                      {(metadata.rootCauseDetails.contributingFactors ?? []).map((f, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                          <span className="text-warning mt-1">•</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* SUSPECTED PR — flagship card */}
          {inc.suspectedPR.number > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-primary/40 bg-card relative overflow-hidden glow-green"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
              <div className="p-4 border-b border-border bg-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4 text-primary" />
                  <div className="text-sm font-medium">Suspected pull request</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-primary">{inc.suspectedPR.confidence}% confidence</span>
                  <a
                    href={inc.suspectedPR.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    Open on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="p-4 grid md:grid-cols-[1fr_auto] gap-4">
                <div>
                  <div className="text-base font-medium">
                    <span className="font-mono text-primary">PR #{inc.suspectedPR.number}</span> — {inc.suspectedPR.title}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    {inc.suspectedPR.repo} · authored by {inc.suspectedPR.author} · deployed{" "}
                    {inc.suspectedPR.deployedAt.replace("T", " ").replace("Z", " UTC")}
                  </div>
                  {inc.suspectedPR.changedFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {inc.suspectedPR.changedFiles.map((f) => (
                        <span key={f} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {inc.suspectedPR.diff && (
                <div className="px-4 pb-4">
                  <div className="rounded-md border border-border bg-surface overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border bg-surface-2/60 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      diff · {inc.suspectedPR.changedFiles[0]}
                    </div>
                    <pre className="p-3 text-[12px] leading-relaxed font-mono overflow-x-auto">
                      {inc.suspectedPR.diff.split("\n").map((line, i) => {
                        const color =
                          line.startsWith("+") && !line.startsWith("+++") ? "text-primary" :
                          line.startsWith("-") && !line.startsWith("---") ? "text-critical" :
                          line.startsWith("@@") ? "text-info" :
                          "text-muted-foreground";
                        return <div key={i} className={color}>{line}</div>;
                      })}
                    </pre>
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {/* Recommended Actions — from investigation metadata */}
          {metadata?.remediation && (metadata.remediation.actions?.length ?? 0) > 0 && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-green-400" />
                <div className="text-sm font-medium">Recommended Actions</div>
                {metadata.remediation.rollbackRecommended && (
                  <span className="ml-auto text-[10px] font-mono text-critical border border-critical/30 bg-critical/10 rounded px-1.5 py-0.5">
                    Rollback recommended
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {(metadata.remediation.actions ?? []).map((action, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-surface-2/40 p-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                      {action.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground">{action.action}</div>
                      <div className="flex gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                        <span>risk: <span className={cn(action.risk === 'high' && 'text-critical', action.risk === 'medium' && 'text-warning', action.risk === 'low' && 'text-primary')}>{action.risk}</span></span>
                        <span>eta: {action.eta}</span>
                        {action.automated && <span className="text-primary">🤖 automated</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {(metadata.remediation.preventionMeasures?.length ?? 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Prevention measures:</div>
                  <ul className="space-y-1">
                    {(metadata.remediation.preventionMeasures ?? []).map((m, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                        <span className="text-primary mt-1">•</span> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Logs / traces tabs */}
          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center border-b border-border px-3">
              {(["logs", "traces"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-3 py-2 text-xs font-mono uppercase tracking-wider border-b-2 -mb-px",
                    tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
              <span className="ml-auto text-[10px] font-mono text-muted-foreground py-2">last 5m · {inc.service}</span>
            </div>
            <div className="p-3 max-h-[280px] overflow-y-auto font-mono text-[12px] leading-relaxed">
              {tab === "logs" ? (
                inc.logs.length > 0 ? inc.logs.map((l, i) => (
                  <div key={i} className="grid grid-cols-[80px_60px_90px_1fr] gap-2 py-0.5">
                    <span className="text-muted-foreground">{l.time}</span>
                    <span className={cn(
                      l.level === "ERROR" && "text-critical",
                      l.level === "WARN" && "text-warning",
                      l.level === "INFO" && "text-info"
                    )}>{l.level}</span>
                    <span className="text-primary truncate">{l.svc}</span>
                    <span className="text-foreground/90">{l.msg}</span>
                  </div>
                )) : <div className="text-muted-foreground">No log entries.</div>
              ) : (
                inc.traces.length ? inc.traces.map((t) => (
                  <div key={t.id} className="grid grid-cols-[100px_1fr_80px_60px] gap-2 py-0.5">
                    <span className="text-muted-foreground">{t.id}</span>
                    <span className="text-foreground/90 truncate">{t.svc}</span>
                    <span className="text-right text-warning tabular-nums">{t.duration}ms</span>
                    <span className={t.status === "err" ? "text-critical" : "text-primary"}>{t.status}</span>
                  </div>
                )) : <div className="text-muted-foreground">No trace samples yet.</div>
              )}
            </div>
          </section>

          {/* Service dep graph */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-medium">Service dependency graph</div>
              <span className="text-[10px] font-mono text-muted-foreground">blast radius</span>
            </div>
            <ServiceDependencyGraph nodes={inc.dependencyGraph.nodes} edges={inc.dependencyGraph.edges} />
          </section>
        </div>

        {/* RIGHT — AI investigation agents + remediation */}
        <div className="space-y-4">
          {/* AI Investigation - Collapsible Agent Cards */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="text-sm font-medium">AI investigation</div>
              <span className="ml-auto text-[10px] font-mono text-primary">
                {investigation ? '6 agents' : 'pending'}
              </span>
            </div>
            {investigation ? (
              <div className="space-y-2">
                {Object.entries(AGENT_CONFIG).map(([agentKey, config]) => {
                  const Icon = config.icon;
                  const activities = agentActivities[agentKey] || [];
                  const isExpanded = expandedAgent === agentKey;
                  return (
                    <div key={agentKey} className="rounded-md border border-border overflow-hidden">
                      <button
                        onClick={() => setExpandedAgent(isExpanded ? null : agentKey)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-2/50 transition-colors"
                      >
                        <Icon className={cn("h-3.5 w-3.5", config.color)} />
                        <span className="text-xs font-medium flex-1 text-left">{config.label}</span>
                        <span className="text-[10px] font-mono text-primary">done</span>
                        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-2 space-y-1 border-t border-border pt-2">
                              {activities.length > 0 ? activities.map((act, i) => (
                                <div key={i} className="text-[11px] font-mono text-foreground/80 flex items-start gap-1.5 py-0.5">
                                  <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full shrink-0", config.color.replace('text-', 'bg-'))} />
                                  {act}
                                </div>
                              )) : (
                                <div className="text-[11px] text-muted-foreground">Completed analysis</div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No investigation data available. Click &quot;Investigate&quot; to start.</div>
            )}
          </section>

          {/* Remediation */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-primary" />
              <div className="text-sm font-medium">Remediation</div>
            </div>
            <div className="rounded-md border border-border bg-surface-2/40 p-3 text-xs space-y-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">target branch</span>
                <span className="text-foreground">main</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">draft branch</span>
                <span className="text-primary">fix/incident-{inc.suspectedPR.number || inc.code}-patch</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">reviewer</span>
                <span className="text-foreground">Rabelani R.</span>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-warning">
              PRISM never auto-merges. A human engineer must approve generation and review the diff.
            </div>
            {remediationStatus?.exists && remediationStatus.prUrl ? (
              <a
                href={remediationStatus.prUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 w-full rounded-md bg-primary/10 border border-primary/40 text-primary py-2.5 text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
              >
                <GitPullRequest className="h-4 w-4" />
                Review on GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <button
                onClick={generateFix}
                disabled={generateRemediation.isPending || createPR.isPending}
                className="mt-3 w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 glow-green disabled:opacity-50"
              >
                {(generateRemediation.isPending || createPR.isPending) ? (
                  <>Generating...</>
                ) : (
                  <>Generate fix PR <ChevronRight className="h-4 w-4" /></>
                )}
              </button>
            )}
            <button
              onClick={() => setShowRemediationModal(true)}
              className="mt-2 block w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              View remediation center →
            </button>
          </section>

          {/* Ask AI */}
          <section className="rounded-lg border border-border bg-card p-4">
            <button
              onClick={() => setShowAskAiModal(true)}
              className="w-full flex items-center gap-3 text-left group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/30 group-hover:bg-primary/20 transition-colors">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Ask AI</div>
                <div className="text-[11px] text-muted-foreground">Ask follow-up questions about this incident</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </section>
        </div>
      </div>

      {/* Remediation Center Modal */}
      <RemediationCenterModal
        open={showRemediationModal}
        onOpenChange={setShowRemediationModal}
        metadata={metadata}
        remediationStatus={remediationStatus}
        inc={inc}
      />

      <RemediationProgressModal
        open={showProgress}
        onOpenChange={setShowProgress}
        remediation={{
          id: inc.id,
          title: `Remediate ${inc.title}`,
          branch: `fix/incident-${inc.suspectedPR.number || inc.code}-patch`,
          repo: inc.suspectedPR.repo,
          incident: inc.code,
          confidence: inc.confidence,
          reviewers: ["Rabelani R."],
        }}
      />

      {showInvestigationModal && (
        <InvestigationModal
          open={showInvestigationModal}
          onOpenChange={(open) => {
            setShowInvestigationModal(open);
            if (!open) refetch();
          }}
          incidentId={params.id}
          incidentTitle={inc.title}
          onComplete={() => refetch()}
        />
      )}

      {/* Ask AI Modal */}
      <AskAiModal
        open={showAskAiModal}
        onOpenChange={setShowAskAiModal}
        incidentId={params.id}
        incidentTitle={inc.title}
        askAi={askAi}
      />
    </div>
  );
}

// Build agent activities from investigation metadata
function buildAgentActivities(metadata: InvestigationMetadata | null): Record<string, string[]> {
  if (!metadata) return {};

  return {
    coordinator: [
      'Loaded incident details and context',
      'Dispatched all 5 sub-agents in sequence',
      'Overall confidence calculated from agent findings',
    ],
    telemetry: [
      `Collected ${metadata.telemetrySummary.logCount} error log entries`,
      `Identified ${metadata.telemetrySummary.errorPatterns.length} distinct error patterns`,
      `Detected ${metadata.telemetrySummary.anomalies.length} anomalies`,
      ...(metadata.telemetrySummary.errorPatterns.slice(0, 2).map(p => `Pattern: "${p.message}" (×${p.count})`)),
    ],
    deployment: [
      metadata.deployment.suspectedDeployment
        ? `Found suspected deployment: v${metadata.deployment.suspectedDeployment.version}`
        : 'No recent deployments correlated',
      `Correlation score: ${metadata.deployment.correlationScore}%`,
      metadata.deployment.timelineAnalysis,
    ],
    'root-cause': [
      `Reasoning: ${metadata.rootCauseDetails.reasoning}`,
      ...((metadata.rootCauseDetails.contributingFactors ?? []).slice(0, 3).map(f => `Factor: ${f}`)),
    ],
    'pr-traceback': [
      metadata.prTraceback.suspectedPR
        ? `Traced to PR #${metadata.prTraceback.suspectedPR.number}: ${String(metadata.prTraceback.suspectedPR.title || 'Unknown')}`
        : 'No PR identified as root cause',
      ...(metadata.prTraceback.commitAnalysis ? [metadata.prTraceback.commitAnalysis] : []),
      ...(metadata.prTraceback.relatedPRs?.slice(0, 2).map(pr => `Related: PR #${pr.number} (${pr.relevance}% relevance)`) || []),
    ],
    remediation: [
      `${(metadata.remediation.actions ?? []).length} remediation actions recommended`,
      metadata.remediation.rollbackRecommended ? '⚠️ Immediate rollback recommended' : 'No rollback needed',
      ...((metadata.remediation.actions ?? []).slice(0, 2).map(a => `${a.priority}. ${a.action}`)),
    ],
  };
}

// Remediation Center Modal
function RemediationCenterModal({
  open,
  onOpenChange,
  metadata,
  remediationStatus,
  inc,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metadata: InvestigationMetadata | null;
  remediationStatus: { exists: boolean; prUrl: string | null; status: string | null } | undefined;
  inc: Incident;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[80vh] flex flex-col">
        <DialogTitle className="flex items-center gap-2 text-base font-medium">
          <Shield className="h-4 w-4 text-primary" />
          Remediation Center
        </DialogTitle>

        <div className="flex-1 overflow-y-auto space-y-4 mt-3">
          {/* Status */}
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <span className={cn(
                "text-xs font-mono rounded border px-2 py-0.5",
                remediationStatus?.exists
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-warning/30 bg-warning/10 text-warning"
              )}>
                {remediationStatus?.exists ? (remediationStatus.status || 'PR Created') : 'Pending'}
              </span>
            </div>
            {remediationStatus?.prUrl && (
              <a
                href={remediationStatus.prUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <GitPullRequest className="h-3 w-3" /> View Pull Request <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Incident Info */}
          <div className="rounded-md border border-border p-3 text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">incident</span>
              <span className="text-foreground">{inc.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">service</span>
              <span className="text-foreground">{inc.service}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">severity</span>
              <span className={cn(
                inc.severity === 'critical' && 'text-critical',
                inc.severity === 'high' && 'text-warning',
              )}>{inc.severity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">confidence</span>
              <span className="text-primary">{inc.confidence}%</span>
            </div>
          </div>

          {/* Actions */}
          {metadata?.remediation && (
            <div>
              <div className="text-sm font-medium mb-2">Recommended Actions</div>
              <div className="space-y-2">
                {(metadata.remediation.actions ?? []).map((action, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-border p-2.5 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                      {action.priority}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{action.action}</div>
                      <div className="flex gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                        <span>risk: <span className={cn(action.risk === 'high' && 'text-critical', action.risk === 'medium' && 'text-warning', action.risk === 'low' && 'text-primary')}>{action.risk}</span></span>
                        <span>eta: {action.eta}</span>
                        {action.automated && <span className="text-primary">automated</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prevention */}
          {metadata?.remediation?.preventionMeasures && metadata.remediation.preventionMeasures.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Prevention Measures</div>
              <ul className="space-y-1.5">
                {metadata.remediation.preventionMeasures.map((m, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                    <span className="text-primary mt-0.5">•</span> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Ask AI Modal
function AskAiModal({
  open,
  onOpenChange,
  incidentId,
  incidentTitle,
  askAi,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incidentId: string;
  incidentTitle: string;
  askAi: ReturnType<typeof useAskIncidentQuestion>;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const handleAsk = () => {
    if (!question.trim()) return;
    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    askAi.mutate(
      { incidentId, question: q },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
        },
        onError: () => {
          setMessages((prev) => [...prev, { role: "ai", text: "Sorry, I couldn't get a response. Please try again." }]);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[80vh] flex flex-col">
        <DialogTitle className="flex items-center gap-2 text-base font-medium">
          <MessageCircle className="h-4 w-4 text-primary" />
          Ask AI about this incident
        </DialogTitle>
        <p className="text-xs text-muted-foreground -mt-1">
          Gemini has context about <span className="font-medium text-foreground">{incidentTitle}</span> including root cause, recommended actions, and telemetry.
        </p>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mt-3 min-h-[200px] max-h-[400px] pr-1">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 text-primary/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Ask anything about this incident</p>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {["What caused this?", "How do I fix this?", "What's the blast radius?", "Should I rollback?"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuestion(suggestion)}
                    className="text-[11px] rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 border border-border text-foreground/90"
                )}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {askAi.isPending && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-surface-2 border border-border">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
            placeholder="Type your question…"
            className="flex-1 rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
            disabled={askAi.isPending}
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || askAi.isPending}
            className="rounded-md bg-primary text-primary-foreground p-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
