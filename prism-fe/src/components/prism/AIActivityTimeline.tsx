import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  agent: string;
  action: string;
  detail: string;
  time: string;
  status: "complete" | "running" | "queued";
}

export function AIActivityTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative space-y-3 pl-6">
      <span className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {steps.map((s, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="relative"
        >
          <span
            className={cn(
              "absolute -left-6 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border",
              s.status === "complete" && "bg-primary/15 border-primary/40 text-primary",
              s.status === "running" && "bg-warning/15 border-warning/40 text-warning",
              s.status === "queued" && "bg-muted border-border text-muted-foreground"
            )}
          >
            {s.status === "complete" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {s.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {s.status === "queued" && <Clock className="h-3 w-3" />}
          </span>
          <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{s.agent}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{s.time}</span>
            </div>
            <div className="text-[13px] text-foreground/90 mt-0.5">{s.action}</div>
            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{s.detail}</div>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
