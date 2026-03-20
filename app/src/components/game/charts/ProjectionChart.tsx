"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ProjectionResult } from "@/lib/engine/projection";

interface Props {
  projection: ProjectionResult;
  currentPortfolio: number;
}

export default function ProjectionChart({ projection, currentPortfolio }: Props) {
  const { p5, p25, p50, p75, p95 } = projection.percentiles;

  const len = p50.length;
  const data = Array.from({ length: len }, (_, i) => ({
    month: i,
    p5: p5[i] ?? 0,
    p25Band: (p25[i] ?? 0) - (p5[i] ?? 0),
    p50Band: (p50[i] ?? 0) - (p25[i] ?? 0),
    p75Band: (p75[i] ?? 0) - (p50[i] ?? 0),
    p95Band: (p95[i] ?? 0) - (p75[i] ?? 0),
    p50: p50[i] ?? 0,
  }));

  function formatCHF(v: number): string {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return v.toFixed(0);
  }

  return (
    <div style={{ width: "100%", height: "200px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#1a3355" strokeDasharray="4 4" />
          <XAxis
            dataKey="month"
            tick={{ fontFamily: "var(--font-body)", fontSize: 14, fill: "#4a6580" }}
            stroke="#1a3355"
            tickFormatter={(v: number) => (v % 12 === 0 ? `Y${Math.floor(v / 12) + 1}` : "")}
          />
          <YAxis
            tick={{ fontFamily: "var(--font-body)", fontSize: 14, fill: "#4a6580" }}
            stroke="#1a3355"
            tickFormatter={formatCHF}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              fontFamily: "var(--font-body)",
              fontSize: "16px",
            }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                p5: "P5",
                p25Band: "P25",
                p50Band: "P50 (median)",
                p75Band: "P75",
                p95Band: "P95",
              };
              const numVal = typeof value === "number" ? value : 0;
              return [`CHF ${formatCHF(numVal)}`, labels[String(name)] ?? String(name)];
            }}
          />
          {/* Stacked areas from p5 up */}
          <Area type="monotone" dataKey="p5" stackId="1" stroke="none" fill="rgba(0,255,135,0.04)" isAnimationActive={false} />
          <Area type="monotone" dataKey="p25Band" stackId="1" stroke="none" fill="rgba(0,255,135,0.08)" isAnimationActive={false} />
          <Area type="monotone" dataKey="p50Band" stackId="1" stroke="#00ff87" strokeWidth={2} fill="rgba(0,255,135,0.15)" isAnimationActive={false} />
          <Area type="monotone" dataKey="p75Band" stackId="1" stroke="none" fill="rgba(0,255,135,0.08)" isAnimationActive={false} />
          <Area type="monotone" dataKey="p95Band" stackId="1" stroke="none" fill="rgba(0,255,135,0.04)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
