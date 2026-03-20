"use client";

import { useState } from "react";
import { useGame } from "@/lib/store/game-context";
import { Asset, Seed } from "@/lib/types";

interface SeedData {
  seed: Seed;
  assets: Asset[];
  prices: Record<string, number[]>;
  dates: string[];
}

interface Props {
  seedData: SeedData;
  startingPortfolio: number;
  monthlyContribution: number;
  playerId: string;
}

const RISK_COLORS = ["", "var(--pixel-green)", "#80e040", "var(--amber)", "#ff8c00", "var(--pixel-red)"];
const RISK_LABELS = ["", "Very Low", "Low", "Medium", "High", "Very High"];

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity_index: "Equity Indices",
  stock: "Stocks",
  bond: "Bonds",
  gold: "Gold",
};

const PRESETS: Record<string, Record<string, number>> = {
  Conservative: { cash: 20, ch_bond: 40 },
  Balanced: { cash: 10, ch_bond: 20 },
  Aggressive: { cash: 5, ch_bond: 5 },
};

export default function PortfolioBuilderScreen({ seedData, startingPortfolio, monthlyContribution, playerId }: Props) {
  const { startGame, phase } = useGame();

  const { seed, assets, prices } = seedData;

  // Build allocation map: assetId → pct
  const initialAlloc: Record<string, number> = {};
  for (const asset of assets) {
    initialAlloc[asset.id] = 0;
  }
  // Start with 100% cash
  if (initialAlloc["cash"] !== undefined) {
    initialAlloc["cash"] = 100;
  }

  const [allocations, setAllocations] = useState<Record<string, number>>(initialAlloc);

  const totalAlloc = Object.values(allocations).reduce((s, v) => s + v, 0);
  const remaining = 100 - totalAlloc;

  function setAlloc(assetId: string, pct: number) {
    setAllocations((prev) => ({ ...prev, [assetId]: pct }));
  }

  function applyPreset(presetName: string) {
    const preset = PRESETS[presetName];
    const newAlloc: Record<string, number> = {};
    let presetTotal = 0;
    for (const asset of assets) {
      newAlloc[asset.id] = preset[asset.id] ?? 0;
      presetTotal += newAlloc[asset.id];
    }
    // Distribute remainder across equity indices
    const equityAssets = assets.filter((a) => a.asset_class === "equity_index");
    if (equityAssets.length > 0) {
      const perEquity = Math.floor((100 - presetTotal) / equityAssets.length);
      for (const ea of equityAssets) {
        newAlloc[ea.id] = perEquity;
      }
      // Add leftover to first equity
      const total2 = Object.values(newAlloc).reduce((s, v) => s + v, 0);
      if (total2 < 100 && equityAssets[0]) {
        newAlloc[equityAssets[0].id] += 100 - total2;
      }
    }
    setAllocations(newAlloc);
  }

  async function handleStart() {
    if (Math.abs(totalAlloc - 100) > 0) return;
    if (!playerId) return;

    await startGame({
      playerId,
      seed,
      assets,
      prices,
      startingPortfolio,
      monthlyContribution,
      allocations: Object.entries(allocations).map(([assetId, pct]) => ({ assetId, pct })),
    });
  }

  // Group assets by class
  const grouped: Record<string, Asset[]> = {};
  for (const asset of assets) {
    if (!grouped[asset.asset_class]) grouped[asset.asset_class] = [];
    grouped[asset.asset_class].push(asset);
  }

  const allocationOk = Math.abs(totalAlloc - 100) <= 0;

  return (
    <div
      className="grid-bg"
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "var(--deep-navy)",
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        overflow: "auto",
        position: "relative",
      }}
    >
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.1,
          filter: "saturate(0.6)",
          zIndex: 0,
        }}
      >
        <source src="/videos/home.mp4" type="video/mp4" />
      </video>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px", position: "relative", zIndex: 1 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "14px", color: "var(--pixel-gold)" }}>
            BUILD YOUR PORTFOLIO
          </h1>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--muted-gray-light)", marginTop: "4px" }}>
            {seed.name} · CHF {startingPortfolio.toLocaleString()} starting capital
          </div>
        </div>

        {/* Allocation status */}
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "11px",
            color: allocationOk ? "var(--pixel-green)" : remaining < 0 ? "var(--pixel-red)" : "var(--amber)",
            textShadow: allocationOk ? "0 0 8px var(--pixel-green-glow)" : "none",
          }}
        >
          {totalAlloc}% / 100%
          {!allocationOk && (
            <span style={{ display: "block", fontSize: "9px", color: "var(--muted-gray-light)" }}>
              {remaining > 0 ? `${remaining}% unallocated` : `${Math.abs(remaining)}% over`}
            </span>
          )}
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--muted-gray-light)", alignSelf: "center" }}>
          PRESETS:
        </span>
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            className="pixel-btn pixel-btn--ghost"
            style={{ fontSize: "9px", padding: "8px 16px" }}
            onClick={() => applyPreset(name)}
          >
            {name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Asset groups */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px", width: "100%", position: "relative", zIndex: 1 }}>
        {Object.entries(grouped).map(([assetClass, groupAssets]) => (
          <div key={assetClass} className="pixel-panel">
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "9px",
                color: "var(--muted-gray-light)",
                marginBottom: "16px",
                textTransform: "uppercase",
              }}
            >
              {ASSET_CLASS_LABELS[assetClass] ?? assetClass}
            </div>
            {groupAssets.map((asset) => {
              const pct = allocations[asset.id] ?? 0;
              return (
                <div
                  key={asset.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 200px 60px",
                    gap: "16px",
                    alignItems: "center",
                    marginBottom: "12px",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--panel-border)",
                  }}
                >
                  {/* Asset info */}
                  <div>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: "8px", color: "var(--off-white)", marginBottom: "4px" }}>
                      {asset.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)" }}>
                      {asset.description}
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: "4px",
                        padding: "1px 6px",
                        border: `1px solid ${RISK_COLORS[asset.risk_level]}`,
                        color: RISK_COLORS[asset.risk_level],
                        fontFamily: "var(--font-body)",
                        fontSize: "14px",
                      }}
                    >
                      Risk: {RISK_LABELS[asset.risk_level]}
                    </div>
                  </div>

                  {/* Slider */}
                  <div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={pct}
                      onChange={(e) => setAlloc(asset.id, parseInt(e.target.value))}
                      className="pixel-slider"
                    />
                  </div>

                  {/* Pct value */}
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "11px",
                      color: pct > 0 ? "var(--pixel-gold)" : "var(--muted-gray)",
                      textAlign: "right",
                    }}
                  >
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "24px",
          paddingTop: "16px",
          borderTop: "2px solid var(--panel-border)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <button
          className="pixel-btn pixel-btn--gold pixel-btn--large"
          onClick={handleStart}
          disabled={!allocationOk || phase === "loading"}
        >
          {phase === "loading" ? "LOADING..." : "START SIMULATION →"}
        </button>
      </div>
    </div>
  );
}
