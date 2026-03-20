"use client";

import { useState } from "react";
import { useGame } from "@/lib/store/game-context";
import EventModal from "./EventModal";
import RebalancePanel from "./RebalancePanel";
import PriceChart from "./charts/PriceChart";
import ProjectionChart from "./charts/ProjectionChart";

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

function formatCHF(v: number): string {
  return `CHF ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function SimulationScreen() {
  const {
    state,
    phase,
    projection,
    currentYear,
    progressPct,
    historicalNews,
    play,
    pause,
    setSpeed,
  } = useGame();

  const [showRebalance, setShowRebalance] = useState(false);

  if (!state) return null;

  const isPlaying = phase === "simulating";
  const drawdown = state.currentDrawdownPct ?? 0;
  const totalPortfolio = state.totalPortfolio ?? 0;
  const effectiveContribution = state.effectiveContribution ?? 0;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "var(--deep-navy)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* News ticker */}
      {historicalNews && (
        <div
          style={{
            background: historicalNews.type === "crash" || historicalNews.type === "shock"
              ? "rgba(255,45,85,0.15)"
              : "rgba(0,255,135,0.1)",
            borderBottom: `1px solid ${historicalNews.type === "crash" || historicalNews.type === "shock" ? "var(--pixel-red)" : "var(--pixel-green)"}`,
            overflow: "hidden",
            height: "36px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "18px",
              color: historicalNews.type === "crash" || historicalNews.type === "shock"
                ? "var(--pixel-red)"
                : "var(--pixel-green)",
              whiteSpace: "nowrap",
              animation: "ticker-scroll 12s linear",
              paddingLeft: "100%",
            }}
          >
            📰 {historicalNews.name}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className="pixel-panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          borderLeft: "none",
          borderRight: "none",
          borderTop: "none",
          padding: "12px 20px",
        }}
      >
        {/* Portfolio value */}
        <div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)", marginBottom: "2px" }}>
            PORTFOLIO VALUE
          </div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(14px, 2.5vw, 22px)",
              color: "var(--pixel-gold)",
              textShadow: "0 0 12px var(--pixel-gold-glow)",
            }}
          >
            {formatCHF(totalPortfolio)}
          </div>
        </div>

        {/* Year + progress */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: "var(--off-white)", marginBottom: "8px" }}>
            YEAR {currentYear} OF 10
          </div>
          <div
            style={{
              width: "200px",
              height: "8px",
              background: "var(--terminal-bg)",
              border: "1px solid var(--panel-border)",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: "var(--pixel-green)",
                boxShadow: "0 0 6px var(--pixel-green-glow)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        {/* Drawdown badge */}
        {drawdown > 5 && (
          <div
            style={{
              background: "rgba(255,45,85,0.15)",
              border: "1px solid var(--pixel-red)",
              padding: "6px 12px",
              fontFamily: "var(--font-heading)",
              fontSize: "9px",
              color: "var(--pixel-red)",
            }}
          >
            ↓ {drawdown.toFixed(1)}% DRAWDOWN
          </div>
        )}

        {/* Contribution */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)" }}>
            MONTHLY CONTRIB
          </div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: "var(--pixel-green)" }}>
            {formatCHF(effectiveContribution / 4)}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Speed buttons */}
          {([1, 3, 5] as const).map((s) => (
            <button
              key={s}
              className={`pixel-btn ${state.speed === s ? "pixel-btn--blue" : "pixel-btn--ghost"}`}
              style={{ fontSize: "8px", padding: "6px 10px" }}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}

          {/* Play/Pause */}
          <button
            className={`pixel-btn ${isPlaying ? "pixel-btn--red" : "pixel-btn--gold"}`}
            style={{ fontSize: "8px", padding: "8px 16px", minWidth: "60px" }}
            onClick={isPlaying ? pause : play}
          >
            {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", overflow: "hidden" }}>
        {/* Left: Price chart */}
        <div className="pixel-panel pixel-panel--bright" style={{ margin: "12px 6px 12px 12px", overflow: "hidden" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "9px", color: "var(--muted-gray-light)", marginBottom: "8px" }}>
            PRICE PERFORMANCE (normalized)
          </div>
          <PriceChart state={state} />
        </div>

        {/* Right: Projection chart */}
        <div className="pixel-panel pixel-panel--bright" style={{ margin: "12px 12px 12px 6px", overflow: "hidden" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "9px", color: "var(--muted-gray-light)", marginBottom: "8px" }}>
            PORTFOLIO PROJECTION
          </div>
          {projection ? (
            <ProjectionChart projection={projection} currentPortfolio={totalPortfolio} />
          ) : (
            <div style={{ fontFamily: "var(--font-body)", color: "var(--muted-gray)", padding: "16px", textAlign: "center" }}>
              Calculating projection...
            </div>
          )}
        </div>
      </div>

      {/* Bottom allocation bar */}
      <div
        className="pixel-panel"
        style={{
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Allocation segments */}
        <div style={{ flex: 1, display: "flex", gap: "4px", minWidth: "200px", height: "32px", overflow: "hidden" }}>
          {state.positions.filter((p) => p.pct > 0).map((pos) => (
            <div
              key={pos.assetId}
              title={`${pos.assetId}: ${pos.pct}% — ${formatCHF(pos.value)}`}
              style={{
                flex: pos.pct,
                background: ASSET_COLORS[pos.assetId] ?? "#4a6580",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--deep-navy)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                fontWeight: "bold",
              }}
            >
              {pos.pct >= 10 ? `${pos.assetId.split("_")[0].toUpperCase()} ${pos.pct}%` : ""}
            </div>
          ))}
        </div>

        {/* Rebalance button */}
        <button
          className="pixel-btn pixel-btn--ghost"
          style={{ fontSize: "8px", padding: "8px 16px" }}
          onClick={() => setShowRebalance(true)}
        >
          ⚖ REBALANCE
        </button>
      </div>

      {/* Event modal */}
      {phase === "event" && <EventModal />}

      {/* Rebalance panel */}
      {showRebalance && <RebalancePanel onClose={() => setShowRebalance(false)} />}
    </div>
  );
}
