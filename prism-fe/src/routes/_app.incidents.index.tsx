import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Search, Loader2, RefreshCw, Sparkles, ExternalLink, BrainCircuit } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/prism/Badges";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useIncidents, useInvestigation } from "@/api/hooks";
import { adaptIncident } from "@/api/adapters";
import { InvestigationModal } from "@/components/prism/InvestigationModal";

export const Route = createFileRoute("/_app/incidents/")({
  head: () => ({ meta: [{ title: "Incidents — PRISM" }] }),
  component: IncidentsPage,
});

const severities: Array<Severity | "all"> = ["all", "critical", "high", "medium", "low"];

// Configurable refresh interval in minutes (change this value to adjust)
const REFRESH_INTERVAL_MINUTES = 5;

function IncidentsPage() {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "predicted" | "detected">("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);
  const [investigatingTitle, setInvestigatingTitle] = useState("");
  const refreshIntervalMs = REFRESH_INTERVAL_MINUTES * 60 * 1000;
  const refreshIntervalSec = REFRESH_INTERVAL_MINUTES * 60;
  const [countdown, setCountdown] = useState(refreshIntervalSec);

  const navigate = useNavigate();
  const { data: backendIncidents, isLoading, refetch, dataUpdatedAt } = useIncidents();

  // Auto-refresh based on configurable interval
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refetch, refreshIntervalMs]);

  // Countdown timer
  useEffect(() => {
    setCountdown(refreshIntervalSec);
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? refreshIntervalSec : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt, refreshIntervalSec]);

  const incidents = backendIncidents ? backendIncidents.map(adaptIncident) : [];

  const filtered = incidents.filter(
    (i) =>
      (filter === "all" || i.severity === filter) &&
      (sourceFilter === "all" || (sourceFilter === "predicted" ? i.isPredicted : !i.isPredicted)) &&
      (q === "" ||
        i.title.toLowerCase().includes(q.toLowerCase()) ||
        i.code.toLowerCase().includes(q.toLowerCase()) ||
        i.service.toLowerCase().includes(q.toLowerCase()))
  );

  const handleInvestigate = (incidentId: string, title: string) => {
    setInvestigatingId(incidentId);
    setInvestigatingTitle(title);
  };

  const handleInvestigationComplete = () => {
    refetch();
  };

  const handleModalClose = (open: boolean) => {
    if (!open && investigatingId) {
      navigate({ to: "/incidents/$id", params: { id: investigatingId } });
      setInvestigatingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Operations · incident registry
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Incidents</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/60 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            refresh
          </button>
          <span className="text-[10px] font-mono text-muted-foreground rounded border border-border bg-surface-2/60 px-2 py-1.5">
            auto-refresh in {countdown >= 60 ? `${Math.floor(countdown / 60)}m ${countdown % 60}s` : `${countdown}s`}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by id, service, title…"
            className="w-full rounded-md border border-border bg-input/40 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-ring/60"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2/60 p-0.5">
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-colors",
                filter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2/60 p-0.5">
          {(["all", "detected", "predicted"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-colors",
                sourceFilter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                s === "predicted" && sourceFilter === s && "bg-info/15 text-info"
              )}
            >
              {s === "predicted" && <BrainCircuit className="inline h-3 w-3 mr-1" />}
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[11px] font-mono text-muted-foreground">
          {filtered.length} of {incidents.length} incidents
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !backendIncidents && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading incidents...</span>
        </div>
      )}

      {/* Table */}
      {incidents.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-border bg-surface-2/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <div className="w-4" />
            <div className="w-20">severity</div>
            <div>incident</div>
            <div className="w-24 text-right">confidence</div>
            <div className="w-24 text-right">progress</div>
            <div className="w-24">status</div>
            <div className="w-20 text-right">duration</div>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((inc) => (
              <IncidentRow
                key={inc.id}
                inc={inc}
                isExpanded={expanded === inc.id}
                onToggle={() => setExpanded(expanded === inc.id ? null : inc.id)}
                onInvestigate={() => handleInvestigate(inc.id, inc.title)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">No incidents match your filters.</div>
            )}
          </div>
        </div>
      )}

      {!isLoading && incidents.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">No incidents found.</div>
      )}

      {/* Investigation Modal */}
      {investigatingId && (
        <InvestigationModal
          open={!!investigatingId}
          onOpenChange={handleModalClose}
          incidentId={investigatingId}
          incidentTitle={investigatingTitle}
          onComplete={handleInvestigationComplete}
        />
      )}
    </div>
  );
}

// --- Incident Row Component ---

function IncidentRow({
  inc,
  isExpanded,
  onToggle,
  onInvestigate,
}: {
  inc: ReturnType<typeof adaptIncident>;
  isExpanded: boolean;
  onToggle: () => void;
  onInvestigate: () => void;
}) {
  const { data: investigation } = useInvestigation(inc.id);
  const hasInvestigation = !!investigation;

  return (
    <div>
      <button
        onClick={onToggle}
        className="grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 w-full text-left hover:bg-surface-2/40 transition-colors"
      >
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
        <SeverityBadge severity={inc.severity} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{inc.code}</span>
            <span className="text-sm truncate">{inc.title}</span>
            {inc.isPredicted && (
              <span className="text-[9px] font-mono uppercase tracking-wider rounded border border-info/30 bg-info/10 text-info px-1 py-0.5 inline-flex items-center gap-0.5">
                <BrainCircuit className="h-2.5 w-2.5" /> AI Predicted
              </span>
            )}
            {inc.githubIssueUrl && (
              <span className="text-[9px] font-mono uppercase tracking-wider rounded border border-warning/30 bg-warning/10 text-warning px-1 py-0.5">ticket</span>
            )}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {inc.service} · {inc.region} · {inc.isPredicted && inc.failureWindowMinutes ? `failure in ~${inc.failureWindowMinutes}m` : `err ${inc.errorRate}`}
          </div>
        </div>
        <div className="w-24 text-right font-mono text-xs text-primary tabular-nums">{inc.confidence}%</div>
        <div className="w-24">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${inc.progress}%` }} />
          </div>
        </div>
        <div className="w-24"><StatusBadge status={inc.status} /></div>
        <div className="w-20 text-right font-mono text-xs tabular-nums text-muted-foreground">{inc.duration}</div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-surface/40"
          >
            <div className="p-4 grid md:grid-cols-3 gap-4 text-sm">
              <div className="md:col-span-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Summary</div>
                <p className="mt-1 text-foreground/90">{inc.description}</p>

                {hasInvestigation && (
                  <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-primary">Investigation Result</span>
                      <span className="text-xs font-mono text-primary">{investigation!.confidenceScore}% confidence</span>
                    </div>
                    <p className="text-xs text-foreground/80">{investigation!.rootCause}</p>
                    {investigation!.suspectedPrUrl && (
                      <div className="flex items-center gap-3">
                        <a
                          href={investigation!.suspectedPrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Suspected PR #{investigation!.suspectedPrNumber} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {inc.githubIssueUrl && (
                  <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-warning">GitHub Issue</span>
                      <a
                        href={inc.githubIssueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-warning hover:underline"
                      >
                        View ticket <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {hasInvestigation && (
                  <Link
                    to="/incidents/$id"
                    params={{ id: inc.id }}
                    className="block text-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors glow-green"
                  >
                    View details
                  </Link>
                )}
                {!hasInvestigation && inc.status === "open" && (
                  <button
                    onClick={onInvestigate}
                    className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors glow-green flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Investigate
                  </button>
                )}
                {!hasInvestigation && (
                  <Link
                    to="/incidents/$id"
                    params={{ id: inc.id }}
                    className="block text-center rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
                  >
                    Open incident
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
