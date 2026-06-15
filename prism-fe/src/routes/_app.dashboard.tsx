import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  AlertOctagon,
  Server,
  Cpu,
  GitPullRequest,
  TrendingDown,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { TelemetryChart } from "@/components/prism/TelemetryChart";
import { SeverityBadge, StatusBadge } from "@/components/prism/Badges";
import { genSeries } from "@/lib/types";
import { useIncidents, useRepositories } from "@/api/hooks";
import { adaptIncident } from "@/api/adapters";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PRISM" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const [series, setSeries] = useState(() => genSeries(48));
  const [tick, setTick] = useState(0);

  const { data: backendIncidents } = useIncidents();
  const { data: backendRepos } = useRepositories();

  const incidents = backendIncidents ? backendIncidents.map(adaptIncident) : [];

  const repoCount = backendRepos?.length ?? 0;
  const activeIncidentCount = incidents.filter(i => i.status !== "resolved").length;
  const investigatingCount = incidents.filter(i => i.status === "investigating").length;

  // Simulated realtime updates
  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => {
        const next = prev.slice(1);
        const last = prev[prev.length - 1];
        next.push({
          t: last.t + 1,
          requests: Math.max(20, Math.round(last.requests + (Math.random() - 0.5) * 20)),
          errors: Math.max(0, Math.round((last.errors ?? 0) + (Math.random() - 0.5) * 6)),
          latency: Math.max(80, Math.round((last.latency ?? 200) + (Math.random() - 0.5) * 25)),
        });
        return next;
      });
      setTick((t) => t + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: "Active incidents", value: String(activeIncidentCount), delta: "live", icon: AlertOctagon, tone: "critical" as const },
    { label: "Services monitored", value: String(repoCount), delta: `${repoCount} repos`, icon: Server, tone: "muted" as const },
    { label: "Investigations", value: String(investigatingCount), delta: investigatingCount > 0 ? "in progress" : "idle", icon: Sparkles, tone: "warning" as const, live: investigatingCount > 0 },
    { label: "MTTR reduction", value: incidents.length > 0 ? "−68%" : "—", delta: incidents.length > 0 ? "vs last quarter" : "no data", icon: TrendingDown, tone: "primary" as const },
    { label: "PRs investigated", value: String(incidents.filter(i => i.confidence > 0).length), delta: "with confidence", icon: GitPullRequest, tone: "info" as const },
  ];

  // Derive recent activity from incidents
  const recentActivity = incidents.slice(0, 8).map((inc) => ({
    agent: inc.status === "investigating" ? "Root Cause Agent" : "Telemetry Agent",
    text: `${inc.status === "investigating" ? "Investigating" : "Monitoring"} ${inc.service} — ${inc.title}`,
    time: new Date(inc.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Operations · production · us-east-1
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Command center</h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="rounded border border-border bg-surface-2/60 px-2 py-1 text-muted-foreground">
            live · refresh 2s
          </span>
          <span key={tick} className="rounded border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
            ◉ 6 agents ready
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.map((s, i) => {
          const toneCls = {
            critical: "text-critical",
            warning: "text-warning",
            primary: "text-primary",
            info: "text-info",
            muted: "text-foreground",
          }[s.tone];
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-border bg-card p-3 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{s.label}</span>
                <s.icon className={`h-3.5 w-3.5 ${toneCls}`} />
              </div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>
                {s.value}
                {s.live && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{s.delta}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Telemetry */}
        <div className="xl:col-span-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium">Global telemetry</div>
              <div className="text-[11px] font-mono text-muted-foreground">requests · errors · last 5m</div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /> requests</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-critical" /> errors</span>
            </div>
          </div>
          <TelemetryChart data={series} height={220} />

          <div className="grid grid-cols-3 mt-4 pt-4 border-t border-border gap-4 text-xs">
            <div>
              <div className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">p50 latency</div>
              <div className="mt-1 text-lg font-semibold text-primary tabular-nums">{series.length > 0 ? `${Math.round(series.reduce((a, s) => a + (s.latency ?? 0), 0) / series.length)}ms` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">p99 latency</div>
              <div className="mt-1 text-lg font-semibold text-warning tabular-nums">{series.length > 0 ? `${Math.max(...series.map(s => s.latency ?? 0))}ms` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">error rate</div>
              <div className="mt-1 text-lg font-semibold text-critical tabular-nums">{series.length > 0 ? `${(series.reduce((a, s) => a + (s.errors ?? 0), 0) / Math.max(1, series.reduce((a, s) => a + s.requests, 0)) * 100).toFixed(2)}%` : "—"}</div>
            </div>
          </div>
        </div>

        {/* AI activity feed */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <div className="text-sm font-medium">AI activity</div>
            </div>
            <span className="text-[10px] font-mono text-primary">live</span>
          </div>
          <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {recentActivity.length === 0 && (
              <li className="text-xs text-muted-foreground text-center py-8 font-mono">No recent activity</li>
            )}
            {recentActivity.map((a, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-md border border-border bg-surface-2/40 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-primary truncate">{a.agent}</span>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{a.time}</span>
                </div>
                <div className="text-xs text-foreground/90 mt-0.5">{a.text}</div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Incidents preview */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-sm font-medium">Active incidents</div>
            <div className="text-[11px] font-mono text-muted-foreground">sorted by severity · last 24h</div>
          </div>
          <Link to="/incidents" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {incidents.slice(0, 4).map((inc) => (
            <Link
              key={inc.id}
              to="/incidents/$id"
              params={{ id: inc.id }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors"
            >
              <SeverityBadge severity={inc.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{inc.code}</span>
                  <span className="text-sm truncate">{inc.title}</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  {inc.service} · {inc.region} · err {inc.errorRate}
                </div>
              </div>
              <div className="hidden md:flex items-center gap-3 text-[11px] font-mono">
                <span className="text-muted-foreground">conf</span>
                <span className="text-primary">{inc.confidence}%</span>
              </div>
              <StatusBadge status={inc.status} />
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums w-16 text-right">{inc.duration}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
