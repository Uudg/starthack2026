"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { SimulationState } from "@/lib/types";

interface Props {
  state: SimulationState;
}

const ASSET_COLORS: Record<string, string> = {
  cash: "#4a6580",
  ch_bond: "#ffb830",
  gold_chf: "#00ff87",
  smi_chf: "#40d4ff",
  sp500_chf: "#00aaff",
  msci_world_chf: "#bf5fff",
  novartis_chf: "#40d4ff",
  nestle_chf: "#00e5ff",
  ubs_chf: "#ffd700",
  apple_chf: "#ff6d00",
};

export default function PriceChart({ state }: Props) {
  const { positions, prices, currentTick } = state;

  // Only held assets (pct > 0)
  const heldAssets = positions.filter((p) => p.pct > 0);
  if (heldAssets.length === 0) return null;

  // Build data: normalize prices to 100 at tick 0
  const ticks = Math.min(currentTick + 1, Object.values(prices)[0]?.length ?? 0);
  const data: Record<string, number>[] = [];

  for (let t = 0; t < ticks; t++) {
    const point: Record<string, number> = { tick: t };
    for (const pos of heldAssets) {
      const assetPrices = prices[pos.assetId];
      if (!assetPrices || !assetPrices[0]) continue;
      const base = assetPrices[0];
      const current = assetPrices[t] ?? assetPrices[assetPrices.length - 1];
      point[pos.assetId] = (current / base) * 100;
    }
    data.push(point);
  }

  function formatXAxis(tick: number): string {
    const year = Math.floor(tick / 52) + 1;
    if (tick % 52 === 0) return `Y${year}`;
    return "";
  }

  return (
    <div style={{ width: "100%", height: "200px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#1a3355" strokeDasharray="4 4" />
          <XAxis
            dataKey="tick"
            tickFormatter={formatXAxis}
            tick={{ fontFamily: "var(--font-body)", fontSize: 14, fill: "#4a6580" }}
            stroke="#1a3355"
            interval={51}
          />
          <YAxis
            tick={{ fontFamily: "var(--font-body)", fontSize: 14, fill: "#4a6580" }}
            stroke="#1a3355"
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              fontFamily: "var(--font-body)",
              fontSize: "16px",
            }}
            formatter={(value, name) => [
              typeof value === "number" ? `${value.toFixed(1)}` : String(value),
              String(name).replace(/_/g, " ").toUpperCase(),
            ]}
            labelFormatter={(label) => `Week ${label}`}
          />
          {heldAssets.map((pos) => (
            <Line
              key={pos.assetId}
              type="monotone"
              dataKey={pos.assetId}
              stroke={ASSET_COLORS[pos.assetId] ?? "#ddeeff"}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
