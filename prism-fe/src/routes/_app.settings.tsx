import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/store/auth";
import { Github, Bell, User, Palette, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — PRISM" }] }),
  component: SettingsPage,
});

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "github", label: "GitHub", icon: Github },
  { id: "splunk", label: "Splunk", icon: Zap },
] as const;

function SettingsPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<typeof sections[number]["id"]>("profile");

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Configuration</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Settings</h1>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-5">
        <nav className="space-y-0.5">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setTab(s.id)} className={cn(
              "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors",
              tab === s.id ? "bg-surface-2 text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
            )}>
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="rounded-lg border border-border bg-card p-5">
          {tab === "profile" && (
            <form onSubmit={(e) => { e.preventDefault(); toast.success("Profile saved"); }} className="space-y-4 max-w-xl">
              <h2 className="text-base font-medium">Profile</h2>
              <Field label="Name" defaultValue={user?.name} />
              <Field label="Email" defaultValue={user?.email} type="email" />
              <Field label="Role" defaultValue={user?.role} />
              <button className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium">Save changes</button>
            </form>
          )}
          {tab === "appearance" && (
            <div className="space-y-4 max-w-xl">
              <h2 className="text-base font-medium">Appearance</h2>
              <p className="text-sm text-muted-foreground">PRISM uses a dark operations theme tuned for low-light SOC environments.</p>
              <div className="grid grid-cols-3 gap-2">
                {["Graphite (default)", "Carbon", "Midnight"].map((t, i) => (
                  <button key={t} className={cn("rounded-md border p-3 text-left text-xs", i === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-surface-2/40")}>
                    <div className="h-12 rounded mb-2" style={{ background: i === 0 ? "linear-gradient(135deg, #0d1a1a, #14222b)" : i === 1 ? "#0a0a0a" : "#0d1228" }} />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "notifications" && (
            <div className="space-y-3 max-w-xl">
              <h2 className="text-base font-medium">Notifications</h2>
              {["Critical incidents", "New AI investigations", "Suspected PR identified", "Remediation drafted", "Validation results"].map((n, i) => (
                <label key={n} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm">
                  <span>{n}</span>
                  <input type="checkbox" defaultChecked={i < 3} className="h-4 w-4 accent-primary" />
                </label>
              ))}
            </div>
          )}
          {tab === "github" && (
            <div className="space-y-4 max-w-xl">
              <h2 className="text-base font-medium">GitHub integration</h2>
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary flex items-center gap-2">
                <Github className="h-4 w-4" /> Connected to <span className="font-mono">github.com/company</span>
              </div>
              <Field label="GitHub App ID" defaultValue="prism-ops-bot" />
              <Field label="Webhook URL" defaultValue="https://hooks.prism.ai/gh" />
              <Field label="Default branch" defaultValue="main" />
            </div>
          )}
          {tab === "splunk" && (
            <div className="space-y-4 max-w-xl">
              <h2 className="text-base font-medium">Splunk integration</h2>
              <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
                Not yet configured — connect your Splunk Observability Cloud to enrich telemetry.
              </div>
              <Field label="Splunk URL" placeholder="https://your-org.splunkcloud.com" />
              <Field label="HEC token" type="password" placeholder="••••••••" />
              <Field label="Index" defaultValue="prism-ops" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <input {...props} className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60" />
    </label>
  );
}
