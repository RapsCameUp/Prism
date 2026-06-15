import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { GitPullRequest, Shield, AlertTriangle } from "lucide-react";
import { useIncidents } from "@/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/remediation")({
  head: () => ({ meta: [{ title: "Remediation — PRISM" }] }),
  component: RemediationPage,
});

function RemediationPage() {
  const { data: incidents } = useIncidents();

  const investigatedIncidents = incidents?.filter(i => i.status === "investigating" || i.confidenceScore) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Remediation</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Approval-gated fixes</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            AI-drafted patches stay in draft until an engineer explicitly approves PR generation. PRISM never auto-merges.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: "Investigated", v: String(investigatedIncidents.length), c: "text-primary" },
            { l: "Pending action", v: String(investigatedIncidents.filter(i => i.status !== "resolved").length), c: "text-warning" },
          ].map((s) => (
            <div key={s.l} className="rounded-md border border-border bg-surface-2/60 px-3 py-2 min-w-[88px] text-center">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.l}</div>
              <div className={cn("text-base font-semibold mt-0.5", s.c)}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {investigatedIncidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-sm font-medium text-muted-foreground">No remediations available</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Investigate incidents first. Once an investigation completes, remediation actions will appear here for review.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {investigatedIncidents.map((inc, i) => (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="grid md:grid-cols-[1fr_auto] gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5",
                      inc.severity === "critical" && "border-critical/30 bg-critical/10 text-critical",
                      inc.severity === "high" && "border-warning/30 bg-warning/10 text-warning",
                      inc.severity === "medium" && "border-info/30 bg-info/10 text-info",
                    )}>
                      {inc.severity}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider rounded border border-border bg-surface-2 px-1.5 py-0.5 text-muted-foreground">
                      {inc.serviceName}
                    </span>
                    {inc.confidenceScore && (
                      <span className="text-[11px] font-mono text-primary">conf {inc.confidenceScore}%</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-base font-medium">{inc.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{inc.description}</p>
                </div>

                <div className="flex md:flex-col gap-2 md:justify-center">
                  <span className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Awaiting review
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
