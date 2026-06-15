import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, GitBranch, Check, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRepositories, useCreateRepository, useDeleteRepository } from "@/api/hooks";
import { adaptRepository } from "@/api/adapters";

export const Route = createFileRoute("/_app/repositories")({
  head: () => ({ meta: [{ title: "Repositories — PRISM" }] }),
  component: ReposPage,
});

function ReposPage() {
  const [open, setOpen] = useState(false);
  const { data: backendRepos } = useRepositories();
  const createRepo = useCreateRepository();
  const deleteRepo = useDeleteRepository();

  // Use backend data
  const repositories = backendRepos ? backendRepos.map(adaptRepository) : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Source control</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Repositories</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect repositories so PRISM can correlate incidents to deploys and PRs.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 glow-green">
          <Plus className="h-4 w-4" /> Add repository
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-border bg-surface-2/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <div>repository</div>
          <div className="w-24">language</div>
          <div className="w-28">environment</div>
          <div className="w-28">status</div>
          <div className="w-24 text-right">incidents</div>
          <div className="w-24 text-right">last sync</div>
          <div className="w-16 text-right">actions</div>
        </div>
        <div className="divide-y divide-border">
          {repositories.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 hover:bg-surface-2/30">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={r.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-mono truncate text-primary hover:underline inline-flex items-center gap-1"
                >
                  {r.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <div className="w-24 text-xs font-mono text-muted-foreground">{r.language}</div>
              <div className="w-28 text-xs font-mono text-muted-foreground">{r.env}</div>
              <div className="w-28">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                  r.status === "connected" && "border-primary/30 bg-primary/10 text-primary",
                  r.status === "degraded" && "border-warning/30 bg-warning/10 text-warning"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", r.status === "connected" ? "bg-primary" : "bg-warning animate-pulse")} />
                  {r.status}
                </span>
              </div>
              <div className="w-24 text-right text-xs font-mono tabular-nums">{r.incidents}</div>
              <div className="w-24 text-right text-xs font-mono text-muted-foreground">{r.lastSync}</div>
              <div className="w-16 text-right">
                <button
                  onClick={() => {
                    if (confirm(`Delete repository "${r.name}"?`)) {
                      deleteRepo.mutate(r.id, {
                        onSuccess: () => toast.success("Repository deleted"),
                        onError: (err) => toast.error("Failed to delete", { description: err.message }),
                      });
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-critical hover:bg-critical/10 transition-colors"
                  title="Delete repository"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>PRISM uses read-only access to correlate commits, PRs, and deploys.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.target as HTMLFormElement);
              const githubUrl = form.get("githubUrl") as string;
              const serviceName = form.get("serviceName") as string;
              const environment = form.get("environment") as string;

              if (!githubUrl || !serviceName) {
                toast.error("GitHub URL and service name are required");
                return;
              }

              createRepo.mutate(
                { name: serviceName, serviceName, githubUrl, environment },
                {
                  onSuccess: () => { setOpen(false); toast.success("Repository connected", { description: "Saved to database." }); },
                  onError: (err) => toast.error("Failed to connect repository", { description: err.message }),
                }
              );
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">GitHub URL</span>
              <input name="githubUrl" type="text" placeholder="https://github.com/owner/repo" required className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60" />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Service mapping</span>
              <input name="serviceName" type="text" placeholder="checkout-service" required className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60" />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Environment</span>
              <select name="environment" className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm">
                <option>production</option><option>staging</option><option>dev</option>
              </select>
            </label>
            <DialogFooter>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" disabled={createRepo.isPending} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
                <Check className="h-3.5 w-3.5" /> {createRepo.isPending ? "Saving..." : "Connect"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
