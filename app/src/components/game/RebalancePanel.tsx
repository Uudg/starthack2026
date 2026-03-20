"use client";

import { useState } from "react";
import { useGame } from "@/lib/store/game-context";

interface Props {
  onClose: () => void;
}

export default function RebalancePanel({ onClose }: Props) {
  const { state, rebalance } = useGame();

  const [allocs, setAllocs] = useState<Record<string, number>>(
    Object.fromEntries((state?.positions ?? []).map((p) => [p.assetId, p.pct]))
  );

  const total = Object.values(allocs).reduce((s, v) => s + v, 0);
  const ok = Math.abs(total - 100) <= 0;

  function handleConfirm() {
    if (!ok) return;
    rebalance(Object.entries(allocs).map(([assetId, pct]) => ({ assetId, pct })));
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
      />

      {/* Panel */}
      <div
        className="pixel-panel pixel-panel--bright"
        style={{
          position: "relative",
          width: "min(400px, 100vw)",
          height: "100vh",
          overflowY: "auto",
          animation: "slide-in-right 0.25s ease",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "11px", color: "var(--off-white)" }}>
            REBALANCE
          </h2>
          <button className="pixel-btn pixel-btn--ghost" style={{ fontSize: "9px", padding: "6px 12px" }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "11px",
            color: ok ? "var(--pixel-green)" : "var(--pixel-red)",
            textAlign: "center",
            padding: "8px",
            border: `1px solid ${ok ? "var(--pixel-green)" : "var(--pixel-red)"}`,
          }}
        >
          {total}% / 100%
        </div>

        {(state?.positions ?? []).map((pos) => (
          <div key={pos.assetId}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--off-white)" }}>
                {pos.assetId.replace(/_/g, " ").toUpperCase()}
              </span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: "var(--pixel-gold)" }}>
                {allocs[pos.assetId] ?? 0}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={allocs[pos.assetId] ?? 0}
              onChange={(e) => setAllocs((prev) => ({ ...prev, [pos.assetId]: parseInt(e.target.value) }))}
              className="pixel-slider"
            />
          </div>
        ))}

        <button
          className="pixel-btn pixel-btn--gold"
          style={{ marginTop: "auto", width: "100%" }}
          onClick={handleConfirm}
          disabled={!ok}
        >
          CONFIRM REBALANCE
        </button>
      </div>
    </div>
  );
}
