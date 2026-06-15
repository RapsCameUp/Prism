import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Cpu, Activity, Zap, Search, GitBranch, Shield, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const agents = [
  { name: "Incident Coordinator", role: "Orchestrates all agents, aggregates findings", status: "active" as const, icon: Cpu, confidence: 96, tasks: "orchestration", processed: "all incidents", latency: 12, memory: 45 },
  { name: "Telemetry Agent", role: "Collects logs, metrics, and distributed traces", status: "active" as const, icon: Activity, confidence: 94, tasks: "telemetry", processed: "logs + metrics + traces", latency: 8, memory: 62 },
  { name: "Deployment Agent", role: "Correlates incidents with deployment events", status: "active" as const, icon: GitBranch, confidence: 91, tasks: "correlation", processed: "deployment history", latency: 15, memory: 38 },
  { name: "Root Cause Agent", role: "AI-powered root cause analysis with dependency discovery", status: "active" as const, icon: Search, confidence: 89, tasks: "analysis", processed: "evidence synthesis", latency: 45, memory: 72 },
  { name: "PR Traceback Agent", role: "Identifies the pull request that caused the incident", status: "active" as const, icon: Network, confidence: 87, tasks: "traceback", processed: "GitHub PRs", latency: 22, memory: 34 },
  { name: "Remediation Agent", role: "Generates prioritized remediation actions", status: "active" as const, icon: Shield, confidence: 92, tasks: "remediation", processed: "action plans", latency: 30, memory: 51 },
];

export const Route = createFileRoute("/_app/agents")({
  head: () => ({ meta: [{ title: "AI Agents — PRISM" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Multi-agent system</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">AI Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">6 specialized agents collaborate to investigate incidents using Gemini 2.5 Flash Lite.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-lg border border-border bg-card p-4 relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-md flex items-center justify-center bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
                      <span className="status-dot bg-primary text-primary" />
                      {a.status}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-primary">conf {a.confidence}%</span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">{a.role}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                {[
                  { l: "focus", v: a.tasks },
                  { l: "processes", v: a.processed },
                ].map((s) => (
                  <div key={s.l} className="rounded border border-border bg-surface-2/40 px-2 py-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.l}</div>
                    <div className="text-[11px] font-medium tabular-nums truncate">{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> memory</span>
                  <span>{a.memory}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full", a.memory > 75 ? "bg-warning" : "bg-primary")} style={{ width: `${a.memory}%` }} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> latency</span>
                <span className="text-foreground">{a.latency}ms</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
