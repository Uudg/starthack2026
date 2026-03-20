"use client";

import { useState } from "react";
import { useGame } from "@/lib/store/game-context";

export default function EventModal() {
  const { activeEvent, activeEventStats, chooseEventOption, state } = useGame();
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<"a" | "b" | null>(null);

  if (!activeEvent) return null;

  async function handleChoice(option: "a" | "b") {
    if (choosing) return;
    setChoosing(true);
    setChosen(option);
    await chooseEventOption(option);
    setChoosing(false);
    setChosen(null);
  }

  const totalVotes = activeEventStats
    ? activeEventStats.option_a_count + activeEventStats.option_b_count
    : 0;
  const pctA = totalVotes > 0 ? Math.round((activeEventStats!.option_a_count / totalVotes) * 100) : null;
  const pctB = totalVotes > 0 ? Math.round((activeEventStats!.option_b_count / totalVotes) * 100) : null;

  function SocialBar({ pct }: { pct: number | null }) {
    if (pct === null) {
      return (
        <div style={{ height: "8px", background: "var(--panel-border)", animation: "pulse-glow 1s infinite" }} />
      );
    }
    const filled = Math.round(pct / 10);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--pixel-green)", letterSpacing: "2px" }}>
          {"█".repeat(filled)}{"░".repeat(10 - filled)}
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "9px", color: "var(--pixel-green)" }}>
          {pct}%
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        className="pixel-panel pixel-panel--gold"
        style={{
          maxWidth: "600px",
          width: "100%",
          animation: "slide-up 0.3s ease",
        }}
      >
        {/* Icon + title */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>{activeEvent.icon}</div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "13px",
              color: "var(--pixel-gold)",
              textShadow: "0 0 12px var(--pixel-gold-glow)",
              lineHeight: 1.4,
            }}
          >
            {activeEvent.title}
          </h2>
        </div>

        {/* Description */}
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "20px",
            color: "var(--off-white)",
            lineHeight: 1.5,
            marginBottom: "16px",
            padding: "12px",
            background: "var(--terminal-bg)",
            border: "1px solid var(--panel-border)",
          }}
        >
          {activeEvent.description}
        </div>

        {/* Portfolio info */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--muted-gray-light)" }}>
            Portfolio:{" "}
            <span style={{ color: "var(--pixel-green)", fontFamily: "var(--font-heading)", fontSize: "11px" }}>
              CHF {(state?.totalPortfolio ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          {(state?.currentDrawdownPct ?? 0) > 0 && (
            <div style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--pixel-red)" }}>
              Drawdown: {(state?.currentDrawdownPct ?? 0).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Social proof */}
        {totalVotes > 0 && (
          <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)", marginBottom: "16px", textAlign: "center" }}>
            {totalVotes.toLocaleString()} players chose before you
          </div>
        )}

        {/* Options */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {(["a", "b"] as const).map((opt) => {
            const option = opt === "a" ? activeEvent.optionA : activeEvent.optionB;
            const pct = opt === "a" ? pctA : pctB;
            const isChosen = chosen === opt;
            return (
              <button
                key={opt}
                onClick={() => handleChoice(opt)}
                disabled={choosing}
                style={{
                  background: isChosen ? "var(--pixel-gold)" : "var(--panel-bg-light)",
                  border: `2px solid ${isChosen ? "var(--pixel-gold)" : "var(--panel-border-bright)"}`,
                  padding: "16px",
                  cursor: choosing ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                  opacity: choosing && !isChosen ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "9px",
                    color: isChosen ? "var(--deep-navy)" : "var(--off-white)",
                    marginBottom: "8px",
                  }}
                >
                  OPTION {opt.toUpperCase()}: {option.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "17px",
                    color: isChosen ? "var(--deep-navy)" : "var(--muted-gray-light)",
                    marginBottom: "8px",
                  }}
                >
                  {option.hint}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "16px",
                    color: isChosen ? "var(--deep-navy)" : "var(--amber)",
                    marginBottom: "8px",
                  }}
                >
                  {option.effect.description}
                </div>
                <SocialBar pct={pct} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
