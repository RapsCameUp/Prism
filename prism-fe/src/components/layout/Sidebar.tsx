import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  AlertOctagon,
  Search,
  GitPullRequest,
  GitBranch,
  Bot,
  Wrench,
  Settings,
} from "lucide-react";
import { PrismLogo } from "@/components/prism/PrismLogo";
import { cn } from "@/lib/utils";
import { useIncidents } from "@/api/hooks";

const items = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Incidents", to: "/incidents", icon: AlertOctagon, badgeKey: "incidents" as const },
  { label: "Investigations", to: "/investigations", icon: Search },
  { label: "PR Traceback", to: "/pr-traceback", icon: GitPullRequest },
  { label: "Repositories", to: "/repositories", icon: GitBranch },
  { label: "AI Agents", to: "/agents", icon: Bot },
  { label: "Remediation", to: "/remediation", icon: Wrench },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: incidents } = useIncidents();

  const activeIncidentCount = incidents?.filter(i => i.status !== "resolved").length ?? 0;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <PrismLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Operations
        </div>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors relative",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary glow-green" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  {"badgeKey" in item && item.badgeKey === "incidents" && activeIncidentCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-critical/15 text-critical">
                      {activeIncidentCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="m-3 rounded-md border border-sidebar-border bg-surface-2/60 p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="status-dot bg-primary text-primary" />
          <span className="text-foreground font-medium">All systems nominal</span>
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground font-mono">
          v4.18.3 · region us-east-1
        </div>
      </div>
    </aside>
  );
}
