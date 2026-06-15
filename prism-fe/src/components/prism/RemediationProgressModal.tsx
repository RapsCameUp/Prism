import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Circle,
  GitBranch,
  GitCommit,
  GitPullRequest,
  ShieldCheck,
  TestTube2,
  FileCheck2,
  Sparkles,
  Brain,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StepStatus = "queued" | "running" | "complete";

interface Step {
  id: string;
  label: string;
  detail: string;
  log: string[];
  icon: React.ElementType;
  durationMs: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  remediation: {
    id: string;
    title: string;
    branch: string;
    repo: string;
    incident: string;
    confidence: number;
    reviewers: string[];
  } | null;
}

const STEPS: Step[] = [
  {
    id: "reasoning",
    label: "Reasoning over incident context",
    detail: "Correlating traces, logs, and recent diffs",
    icon: Brain,
    durationMs: 1600,
    log: [
      "→ loading incident timeline (47 spans)",
      "→ ranking suspect commits via causal model",
      "→ root cause: connection pool exhaustion in OrderService",
    ],
  },
  {
    id: "branch",
    label: "Creating remediation branch",
    detail: "Forking from main at HEAD",
    icon: GitBranch,
    durationMs: 900,
    log: [
      "$ git fetch origin main",
      "$ git checkout -b prism/fix-pool-exhaustion-7421",
      "✓ branch created",
    ],
  },
  {
    id: "patch",
    label: "Drafting patch",
    detail: "Generating minimal-surface code change",
    icon: Sparkles,
    durationMs: 1400,
    log: [
      "→ editing src/db/pool.ts (+12 / −4)",
      "→ editing src/services/orders.ts (+6 / −2)",
      "✓ 2 files modified",
    ],
  },
  {
    id: "lint",
    label: "Running linter & type-check",
    detail: "eslint • tsc --noEmit",
    icon: FileCheck2,
    durationMs: 1100,
    log: [
      "$ bun run lint",
      "  0 errors, 0 warnings",
      "$ bun run typecheck",
      "  ✓ no type errors",
    ],
  },
  {
    id: "unit",
    label: "Running unit tests",
    detail: "vitest — 312 tests",
    icon: TestTube2,
    durationMs: 1500,
    log: [
      "$ vitest run --coverage",
      "  ✓ 312 passed (4.2s)",
      "  coverage: 87.4% (+0.3%)",
    ],
  },
  {
    id: "integration",
    label: "Running integration tests",
    detail: "End-to-end suite against staging",
    icon: TestTube2,
    durationMs: 1700,
    log: [
      "$ bun run test:integration",
      "  ✓ orders.checkout.e2e (2.1s)",
      "  ✓ db.pool.recovery.e2e (3.4s)",
      "  ✓ 48 scenarios passed",
    ],
  },
  {
    id: "security",
    label: "Security & dependency scan",
    detail: "Semgrep • Trivy • OSV",
    icon: ShieldCheck,
    durationMs: 1300,
    log: [
      "→ semgrep: 0 findings",
      "→ trivy: 0 critical, 0 high",
      "→ osv: no advisories on touched deps",
    ],
  },
  {
    id: "commit",
    label: "Committing changes",
    detail: "Signed commit with incident reference",
    icon: GitCommit,
    durationMs: 800,
    log: [
      '$ git commit -S -m "fix(orders): bound db pool, add backpressure"',
      "  [prism/fix-pool-exhaustion-7421 a3f9c21] signed",
    ],
  },
  {
    id: "pr",
    label: "Opening pull request",
    detail: "Assigning reviewers & checks",
    icon: GitPullRequest,
    durationMs: 1000,
    log: [
      "→ pushing branch to origin",
      "→ opening PR against main",
      "✓ PR #1284 opened — awaiting human approval",
    ],
  },
];

export function RemediationProgressModal({ open, onOpenChange, remediation }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [statuses, setStatuses] = useState<StepStatus[]>(() => STEPS.map(() => "queued"));
  const [done, setDone] = useState(false);
  const prNumber = 1284;

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    setStatuses(STEPS.map(() => "queued"));
    setDone(false);

    let cancelled = false;
    let i = 0;

    const runStep = () => {
      if (cancelled || i >= STEPS.length) {
        if (!cancelled) setDone(true);
        return;
      }
      setStatuses((prev) => {
        const next = [...prev];
        next[i] = "running";
        return next;
      });
      setActiveIdx(i);
      setTimeout(() => {
        if (cancelled) return;
        setStatuses((prev) => {
          const next = [...prev];
          next[i] = "complete";
          return next;
        });
        i++;
        runStep();
      }, STEPS[i].durationMs);
    };

    const t = setTimeout(runStep, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, remediation?.id]);

  const completedCount = statuses.filter((s) => s === "complete").length;
  const progress = (completedCount / STEPS.length) * 100;
  const active = STEPS[activeIdx];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-border bg-background gap-0">
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-border bg-surface-2/60">
          <DialogTitle className="sr-only">Remediation in progress</DialogTitle>
          <div className="flex items-start gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary shrink-0">
              <Sparkles className="h-4 w-4" />
              {!done && (
                <span className="absolute inset-0 rounded-md border border-primary/40 animate-ping" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  Patch Agent
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5",
                    done
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-warning/30 bg-warning/10 text-warning"
                  )}
                >
                  {done ? "PR ready for review" : "Working"}
                </span>
                {remediation && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    · {remediation.incident}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm font-medium truncate">
                {remediation?.title ?? "Drafting remediation"}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-muted-foreground truncate">
                {remediation?.repo} · {remediation?.branch}
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1 flex-1 rounded-full bg-surface overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/70 to-primary"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {completedCount}/{STEPS.length}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="grid md:grid-cols-[1fr_1.1fr] max-h-[60vh]">
          {/* Steps list */}
          <ol className="border-r border-border bg-surface-2/30 p-3 space-y-1 overflow-y-auto">
            {STEPS.map((step, i) => {
              const status = statuses[i];
              const Icon = step.icon;
              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors",
                    status === "running" && "bg-primary/5 border border-primary/20",
                    status !== "running" && "border border-transparent"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {status === "complete" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-warning" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={cn(
                          "h-3 w-3 shrink-0",
                          status === "complete"
                            ? "text-primary"
                            : status === "running"
                              ? "text-warning"
                              : "text-muted-foreground/60"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[13px] font-medium truncate",
                          status === "queued" && "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                      {step.detail}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Live console */}
          <div className="bg-[oklch(0.18_0.01_240)] dark:bg-[oklch(0.13_0.01_240)] overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 sticky top-0 bg-inherit">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-critical/70" />
                <span className="h-2 w-2 rounded-full bg-warning/70" />
                <span className="h-2 w-2 rounded-full bg-primary/70" />
                <span className="ml-2">agent-stream</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {active?.id}
              </span>
            </div>
            <div className="p-3 font-mono text-[11.5px] leading-relaxed space-y-3">
              <AnimatePresence mode="popLayout">
                {STEPS.slice(0, activeIdx + 1).map((step, i) => {
                  const status = statuses[i];
                  if (status === "queued") return null;
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex items-center gap-2 text-foreground/90">
                        <span className="text-primary">▸</span>
                        <span>{step.label}</span>
                        {status === "complete" && (
                          <span className="text-primary text-[10px]">[ok]</span>
                        )}
                      </div>
                      <div className="mt-1 pl-4 space-y-0.5 text-muted-foreground">
                        {step.log.map((line, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: j * 0.12 }}
                            className={cn(
                              line.startsWith("✓") && "text-primary",
                              line.startsWith("$") && "text-foreground/80"
                            )}
                          >
                            {line}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
                {done && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="pt-2 border-t border-border/40 text-primary"
                  >
                    ▸ remediation complete — handing off to human reviewer
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-surface-2/60 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
            {done ? (
              <>
                <span className="flex items-center gap-1.5 text-primary">
                  <GitPullRequest className="h-3.5 w-3.5" /> PR #{prNumber}
                </span>
                <span>· reviewers: {remediation?.reviewers.slice(0, 2).join(", ")}</span>
                <span>· confidence {remediation?.confidence}%</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> {active?.label}…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {done && (
              <button
                onClick={() => navigator.clipboard?.writeText(`PR #${prNumber}`)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors"
              >
                <Copy className="h-3 w-3" /> Copy PR ref
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              disabled={!done}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                done
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
                  : "bg-surface border border-border text-muted-foreground cursor-not-allowed"
              )}
            >
              {done ? (
                <>
                  Review on GitHub <ExternalLink className="h-3 w-3" />
                </>
              ) : (
                "Working…"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
