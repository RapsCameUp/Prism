import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, Check, Cpu, GitPullRequest, Activity, ShieldCheck } from "lucide-react";
import { PrismLogo } from "@/components/prism/PrismLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/request-access")({
  head: () => ({ meta: [{ title: "Request access — PRISM" }] }),
  component: RequestAccess,
});

function RequestAccess() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Access request submitted", {
        description: "Our team will reach out within one business day.",
      });
      navigate({ to: "/login" });
    }, 700);
  };

  const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
      />
    </label>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-radial-fade" />

      <div className="relative min-h-screen grid lg:grid-cols-2">
        {/* Sidebar */}
        <div className="hidden lg:flex flex-col justify-between border-r border-border bg-surface/60 backdrop-blur p-10">
          <PrismLogo />
          <div>
            <h2 className="text-3xl font-semibold tracking-tight leading-tight">
              Autonomous reliability engineering
              <span className="text-primary text-glow-green">.</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              PRISM correlates telemetry, deployments, and source control to surface the exact PR
              that introduced an incident — then proposes a fix you approve in one click.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { icon: Activity, t: "Real-time telemetry correlation", d: "Cross-service trace + log analysis under 30s" },
                { icon: GitPullRequest, t: "PR-level root cause traceback", d: "92% median confidence on suspected commits" },
                { icon: Cpu, t: "Approval-gated remediation", d: "AI drafts the fix; you ship it" },
                { icon: ShieldCheck, t: "SOC 2 / ISO 27001", d: "Self-hosted control plane available" },
              ].map((f, i) => (
                <motion.div
                  key={f.t}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex gap-3"
                >
                  <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{f.t}</div>
                    <div className="text-xs text-muted-foreground">{f.d}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            Trusted by SRE teams at Fortune 500 fintech, healthtech, and e-commerce.
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col">
          <header className="flex items-center justify-between px-6 py-5 lg:hidden">
            <PrismLogo />
          </header>

          <div className="flex-1 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-xl rounded-xl border border-border bg-card/70 backdrop-blur-xl shadow-2xl"
            >
              <div className="border-b border-border bg-surface-2/60 px-6 py-3 flex items-center justify-between">
                <Link to="/login" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Access request</span>
              </div>

              <form onSubmit={onSubmit} className="p-6 space-y-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Request access to PRISM</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tell us about your team. We'll provision a demo environment within 24 hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full name" required placeholder="Jane Doe" />
                  <Field label="Work email" type="email" required placeholder="jane@company.com" />
                  <Field label="Company" required placeholder="Acme Inc." />
                  <Field label="Role" required placeholder="Sr. SRE / DevOps Lead" />
                </div>

                <label className="block">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Team size</span>
                  <select
                    required
                    className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60"
                  >
                    <option>1–10 engineers</option>
                    <option>11–50 engineers</option>
                    <option>51–200 engineers</option>
                    <option>200+ engineers</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Reason for access</span>
                  <textarea
                    rows={3}
                    required
                    placeholder="What incident workflows are you trying to improve?"
                    className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60 resize-none"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 glow-green"
                >
                  {submitting ? "Submitting…" : (<>Submit request <Check className="h-4 w-4" /></>)}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
