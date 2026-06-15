import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Loader2 } from "lucide-react";
import { AIActivityTimeline } from "@/components/prism/AIActivityTimeline";
import { useIncidents } from "@/api/hooks";
import { adaptIncident } from "@/api/adapters";

export const Route = createFileRoute("/_app/investigations")({
  head: () => ({ meta: [{ title: "Investigations — PRISM" }] }),
  component: InvestigationsPage,
});

function InvestigationsPage() {
  const { data: backendIncidents, isLoading } = useIncidents();
  const incidents = backendIncidents ? backendIncidents.map(adaptIncident) : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Live investigations</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Investigations</h1>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {incidents.filter(i => i.status === "investigating").map((inc) => (
          <Link key={inc.id} to="/incidents/$id" params={{ id: inc.id }} className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs text-muted-foreground">{inc.code}</span>
                <span className="text-sm font-medium">{inc.title}</span>
              </div>
              <span className="text-xs font-mono text-primary">{inc.confidence}%</span>
            </div>
            <AIActivityTimeline steps={inc.aiTimeline.slice(0, 4)} />
          </Link>
        ))}
      </div>
    </div>
  );
}
