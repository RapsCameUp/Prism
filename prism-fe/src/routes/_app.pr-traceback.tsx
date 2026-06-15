import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, GitPullRequest } from "lucide-react";
import { useIncidents } from "@/api/hooks";
import { adaptIncident } from "@/api/adapters";

export const Route = createFileRoute("/_app/pr-traceback")({
  head: () => ({ meta: [{ title: "PR Traceback — PRISM" }] }),
  component: PRTracebackPage,
});

function PRTracebackPage() {
  const { data: backendIncidents } = useIncidents();
  const incidents = backendIncidents ? backendIncidents.map(adaptIncident) : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Source correlation</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">PR Traceback</h1>
        <p className="text-sm text-muted-foreground mt-1">Pull requests linked to recent incidents by the PR Traceback Agent.</p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
        {incidents.map((inc) => (
          <div key={inc.id} className="p-4 grid md:grid-cols-[1fr_auto] gap-3 items-center hover:bg-surface-2/30">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <GitPullRequest className="h-4 w-4 text-primary" />
                <span className="font-mono text-primary text-sm">PR #{inc.suspectedPR.number}</span>
                <span className="text-sm">{inc.suspectedPR.title}</span>
                <span className="text-[11px] font-mono text-muted-foreground">→ linked to {inc.code}</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground mt-1">
                {inc.suspectedPR.repo} · {inc.suspectedPR.author} · deployed {inc.suspectedPR.deployedAt.replace("T", " ").replace("Z", "Z")} · <span className="text-primary">{inc.suspectedPR.confidence}% confidence</span>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={inc.suspectedPR.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface">
                GitHub <ExternalLink className="h-3 w-3" />
              </a>
              <Link to="/incidents/$id" params={{ id: inc.id }} className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90">
                Open incident
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
