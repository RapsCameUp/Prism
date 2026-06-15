import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ t: number; requests: number; errors: number; latency?: number }>;
  height?: number;
  showAxis?: boolean;
}

export function TelemetryChart({ data, height = 180, showAxis = true }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.20 145)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="oklch(0.78 0.20 145)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.24 25)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="oklch(0.62 0.24 25)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
        {showAxis && (
          <>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
          cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "2 4" }}
        />
        <Area type="monotone" dataKey="requests" stroke="oklch(0.78 0.20 145)" strokeWidth={1.5} fill="url(#reqGrad)" />
        <Area type="monotone" dataKey="errors" stroke="oklch(0.62 0.24 25)" strokeWidth={1.5} fill="url(#errGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
