import { useMemo } from "react";
import { motion } from "framer-motion";
import { Database, Server, Globe, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Node { id: string; label: string; type: "service" | "db" | "api" | "cache"; impacted: boolean; root?: boolean }
interface Edge { from: string; to: string }

const iconFor = (t: Node["type"]) =>
  t === "db" ? Database : t === "api" ? Globe : t === "cache" ? Zap : Server;

export function ServiceDependencyGraph({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}) {
  // Handle empty graph gracefully
  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground font-mono">
        No dependency data available yet
      </div>
    );
  }

  // Simple radial layout: root at center, others on a ring
  const layout = useMemo(() => {
    const W = 640, H = 360, cx = W / 2, cy = H / 2;
    const root = nodes.find((n) => n.root) ?? nodes[0];
    const others = nodes.filter((n) => n.id !== root.id);
    const r = Math.min(W, H) * 0.38;
    const positions: Record<string, { x: number; y: number }> = {
      [root.id]: { x: cx, y: cy },
    };
    others.forEach((n, i) => {
      const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
    return { W, H, positions };
  }, [nodes]);

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-surface/60 bg-grid">
      <div className="absolute inset-0 bg-radial-fade pointer-events-none" />
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="relative w-full h-[360px]">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
          </marker>
          <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="oklch(0.62 0.24 25)" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = layout.positions[e.from], b = layout.positions[e.to];
          if (!a || !b) return null;
          const fromImpacted = nodes.find((n) => n.id === e.from)?.impacted;
          const toImpacted = nodes.find((n) => n.id === e.to)?.impacted;
          const hot = fromImpacted && toImpacted;
          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={hot ? "oklch(0.62 0.24 25 / 0.7)" : "var(--color-border)"}
                strokeWidth={hot ? 1.8 : 1}
                strokeDasharray={hot ? "0" : "4 4"}
                markerEnd={hot ? "url(#arrow-hot)" : "url(#arrow)"}
              />
              {hot && (
                <motion.circle
                  r={3}
                  fill="oklch(0.62 0.24 25)"
                  initial={{ cx: a.x, cy: a.y, opacity: 0 }}
                  animate={{ cx: b.x, cy: b.y, opacity: [0, 1, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                />
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = layout.positions[n.id];
          const Icon = iconFor(n.type);
          return (
            <g key={n.id} transform={`translate(${p.x - 70}, ${p.y - 22})`}>
              <foreignObject width={140} height={44}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-surface-2 px-2 py-1.5 text-xs shadow-sm",
                    n.root && n.impacted && "border-critical/60 glow-red",
                    n.impacted && !n.root && "border-warning/50",
                    !n.impacted && "border-border text-muted-foreground"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", n.impacted ? "text-critical" : "text-muted-foreground")} />
                  <span className="truncate font-mono text-[11px]">{n.label}</span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 right-2 flex gap-3 text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-critical" />impacted</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />degraded</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" />nominal</span>
      </div>
    </div>
  );
}
