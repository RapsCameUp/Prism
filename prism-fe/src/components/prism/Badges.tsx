import { cn } from "@/lib/utils";
import type { Severity, IncidentStatus } from "@/lib/types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-critical/15 text-critical border-critical/30",
    high: "bg-warning/15 text-warning border-warning/30",
    medium: "bg-info/15 text-info border-info/30",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
        map[severity]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          severity === "critical" && "bg-critical animate-pulse",
          severity === "high" && "bg-warning",
          severity === "medium" && "bg-info",
          severity === "low" && "bg-muted-foreground"
        )}
      />
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const map: Record<IncidentStatus, string> = {
    open: "bg-critical/10 text-critical border-critical/20",
    investigating: "bg-warning/10 text-warning border-warning/20",
    mitigated: "bg-info/10 text-info border-info/20",
    resolved: "bg-primary/10 text-primary border-primary/20",
    monitoring: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
        map[status]
      )}
    >
      {status}
    </span>
  );
}
