import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { PrismLogo } from "@/components/prism/PrismLogo";
import { useAuth } from "@/store/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — PRISM" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("admin@prism.ai");
  const [password, setPassword] = useState("password123");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await login(email, password);
      if (ok) {
        toast.success("Authenticated", { description: "Welcome back to PRISM." });
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Invalid credentials", { description: "Check your email and password." });
      }
    } catch {
      toast.error("Connection failed", { description: "Cannot reach backend server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-fade" />
      <div className="absolute inset-0 scanline opacity-50 pointer-events-none" />

      {/* Animated horizon lines */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.3 }}
        className="absolute inset-x-0 top-2/3 h-px bg-gradient-to-r from-transparent via-info/30 to-transparent"
      />

      <div className="relative min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <PrismLogo />
          <div className="text-xs font-mono text-muted-foreground">
            system status: <span className="text-primary">operational</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="rounded-xl border border-border bg-card/70 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="border-b border-border bg-surface-2/60 px-6 py-3 flex items-center justify-between">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  ops console
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  TLS 1.3 · SSO
                </div>
              </div>

              <div className="p-6">
                <h1 className="text-xl font-semibold tracking-tight">Sign in to PRISM</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Enterprise reliability engineering, accelerated by AI.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div>
                    <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Work email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="mt-1 w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm focus:outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Password</label>
                    <div className="mt-1 relative">
                      <input
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        className="w-full rounded-md border border-border bg-input/40 px-3 py-2 pr-10 text-sm focus:outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border bg-input accent-primary"
                      />
                      Remember this device
                    </label>
                    <a href="#" className="text-muted-foreground hover:text-primary">Forgot password?</a>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 glow-green"
                  >
                    {loading ? "Authenticating…" : "Sign in"}
                    {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-border text-center text-xs text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/request-access" className="text-primary hover:underline">Request access</Link>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-dashed border-border bg-surface/40 px-3 py-2 text-[11px] font-mono text-muted-foreground">
              demo · admin@prism.ai / password123
            </div>
          </motion.div>
        </main>

        <footer className="px-6 py-4 text-[11px] font-mono text-muted-foreground flex justify-between">
          <span>PRISM Ops Console · v4.18.3</span>
          <span>SOC 2 Type II · ISO 27001</span>
        </footer>
      </div>
    </div>
  );
}
