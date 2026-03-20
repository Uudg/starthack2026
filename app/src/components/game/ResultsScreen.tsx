"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/lib/store/game-context";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { getProfileDisplay } from "@/lib/engine/scoring";
import { Seed, Asset } from "@/lib/types";

interface SeedData {
  seed: Seed;
  assets: Asset[];
  prices: Record<string, number[]>;
  dates: string[];
}

interface Props {
  seedData: SeedData | null;
}

const PROFILE_COLORS: Record<string, string> = {
  panic_seller: "var(--pixel-red)",
  cash_hoarder: "var(--amber)",
  overthinker: "var(--pixel-blue)",
  strategist: "var(--pixel-green)",
  diamond_hands: "#40d4ff",
  momentum_chaser: "var(--pixel-purple)",
};

function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setCurrent(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return <span>{current}</span>;
}

function formatCHF(v: number): string {
  return `CHF ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ResultsScreen({ seedData }: Props) {
  const {
    state,
    compositeScore,
    behavioralProfile,
    benchmarkFinal,
    elapsedSeconds,
    sessionId,
  } = useGame();
  const { entries, fetchLeaderboard } = useLeaderboard();

  useEffect(() => {
    if (seedData?.seed.id) {
      fetchLeaderboard(seedData.seed.id);
    } else {
      fetchLeaderboard();
    }
  }, []);

  if (!state || !compositeScore || !behavioralProfile) return null;

  const profile = getProfileDisplay(behavioralProfile, {
    finalPortfolio: state.totalPortfolio,
    benchmarkFinal: benchmarkFinal ?? state.totalPortfolio,
    totalRebalances: state.totalRebalances,
    cashHeavyWeeks: state.cashHeavyWeeks,
  });

  const delta = state.totalPortfolio - (benchmarkFinal ?? state.totalPortfolio);
  const beatBenchmark = delta >= 0;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "var(--deep-navy)",
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Title */}
        <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(16px, 3vw, 28px)",
              color: "var(--pixel-gold)",
              textShadow: "0 0 20px var(--pixel-gold-glow)",
              marginBottom: "8px",
            }}
          >
            SIMULATION COMPLETE
          </h1>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "20px", color: "var(--muted-gray-light)" }}>
            {seedData?.seed.name}
          </div>
        </div>

        {/* Behavioral profile */}
        <div
          className="pixel-panel"
          style={{
            border: `2px solid ${PROFILE_COLORS[behavioralProfile] ?? "var(--pixel-gold)"}`,
            boxShadow: `0 0 24px ${PROFILE_COLORS[behavioralProfile] ?? "var(--pixel-gold)"}44`,
            textAlign: "center",
            animation: "slide-up 0.4s ease",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>{profile.icon}</div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              color: PROFILE_COLORS[behavioralProfile] ?? "var(--pixel-gold)",
              marginBottom: "12px",
            }}
          >
            {profile.name}
          </h2>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "20px", color: "var(--off-white)", maxWidth: "600px", margin: "0 auto" }}>
            {profile.description}
          </div>
        </div>

        {/* Historical reveal */}
        {seedData?.seed.reveal_title && (
          <div className="pixel-panel pixel-panel--bright" style={{ animation: "slide-up 0.5s ease" }}>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "11px",
                color: "var(--pixel-blue)",
                marginBottom: "16px",
              }}
            >
              THE ERA REVEALED: {seedData.seed.reveal_title}
            </h3>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "19px", color: "var(--off-white)", lineHeight: 1.6, marginBottom: "16px" }}>
              {seedData.seed.reveal_text}
            </div>
            {/* Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(seedData.seed.historical_events ?? []).map((evt, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    padding: "8px",
                    background: "var(--terminal-bg)",
                    border: "1px solid var(--panel-border)",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      background:
                        evt.type === "crash" || evt.type === "shock"
                          ? "var(--pixel-red)"
                          : evt.type === "recovery" || evt.type === "milestone"
                          ? "var(--pixel-green)"
                          : "var(--amber)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "17px", color: "var(--off-white)" }}>
                    {evt.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Numbers grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            animation: "slide-up 0.6s ease",
          }}
        >
          {[
            {
              label: "FINAL PORTFOLIO",
              value: formatCHF(state.totalPortfolio),
              color: "var(--pixel-gold)",
            },
            {
              label: "BENCHMARK",
              value: formatCHF(benchmarkFinal ?? 0),
              color: "var(--muted-gray-light)",
            },
            {
              label: beatBenchmark ? "BEAT BY" : "LAGGED BY",
              value: formatCHF(Math.abs(delta)),
              color: beatBenchmark ? "var(--pixel-green)" : "var(--pixel-red)",
            },
            {
              label: "SCORE",
              value: compositeScore !== null ? (
                <CountUp target={Math.round(compositeScore)} />
              ) : "—",
              color: "var(--pixel-green)",
              suffix: "/100",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="pixel-panel pixel-panel--bright"
              style={{ textAlign: "center" }}
            >
              <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)", marginBottom: "8px" }}>
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(10px, 1.5vw, 14px)",
                  color: item.color,
                }}
              >
                {item.value}{item.suffix ?? ""}
              </div>
            </div>
          ))}
        </div>

        {/* Key moments */}
        {state.triggeredEvents.length > 0 && (
          <div className="pixel-panel" style={{ animation: "slide-up 0.7s ease" }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: "var(--off-white)", marginBottom: "16px" }}>
              KEY MOMENTS
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {state.triggeredEvents.map((evt, i) => {
                const year = Math.floor(evt.tick / 52) + 1;
                const diff = evt.portfolioAfter - evt.portfolioBefore;
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 1fr auto auto",
                      gap: "12px",
                      alignItems: "center",
                      padding: "10px",
                      background: "var(--terminal-bg)",
                      border: "1px solid var(--panel-border)",
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)" }}>
                      YEAR {year}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "17px", color: "var(--off-white)" }}>
                      {evt.key.replace(/\./g, " — ").replace(/_/g, " ").toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "9px",
                        color: "var(--pixel-blue)",
                        padding: "3px 8px",
                        border: "1px solid var(--pixel-blue)",
                      }}
                    >
                      CHOSE {evt.chosen.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "9px",
                        color: diff >= 0 ? "var(--pixel-green)" : "var(--pixel-red)",
                      }}
                    >
                      {diff >= 0 ? "+" : ""}{formatCHF(diff)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            animation: "slide-up 0.8s ease",
          }}
        >
          <div className="pixel-panel pixel-panel--bright" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)" }}>REBALANCES</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "18px", color: "var(--off-white)" }}>{state.totalRebalances}</div>
          </div>
          <div className="pixel-panel pixel-panel--bright" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)" }}>MAX DRAWDOWN</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "14px", color: "var(--pixel-red)" }}>
              {(state.maxDrawdownPct ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="pixel-panel pixel-panel--bright" style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray-light)" }}>TIME</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "14px", color: "var(--off-white)" }}>
              {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {entries.length > 0 && (
          <div className="pixel-panel pixel-panel--bright" style={{ animation: "slide-up 0.9s ease" }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: "var(--pixel-gold)", marginBottom: "16px" }}>
              LEADERBOARD
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {entries.slice(0, 10).map((entry, i) => {
                const isMe = entry.session_id === sessionId;
                return (
                  <div
                    key={entry.session_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 80px 80px",
                      gap: "8px",
                      alignItems: "center",
                      padding: "8px 10px",
                      background: isMe ? "rgba(255,215,0,0.1)" : "var(--terminal-bg)",
                      border: `1px solid ${isMe ? "var(--pixel-gold)" : "var(--panel-border)"}`,
                      fontFamily: "var(--font-body)",
                      fontSize: "17px",
                    }}
                  >
                    <div style={{ color: i < 3 ? "var(--pixel-gold)" : "var(--muted-gray-light)" }}>
                      #{i + 1}
                    </div>
                    <div style={{ color: "var(--off-white)" }}>
                      {entry.nickname} {isMe && "← YOU"}
                    </div>
                    <div style={{ color: "var(--pixel-green)", textAlign: "right" }}>
                      {entry.composite_score.toFixed(0)}pts
                    </div>
                    <div style={{ color: "var(--pixel-gold)", textAlign: "right" }}>
                      {formatCHF(entry.final_portfolio)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Play again */}
        <div style={{ textAlign: "center", paddingBottom: "32px" }}>
          <button
            className="pixel-btn pixel-btn--gold pixel-btn--large"
            onClick={() => window.location.reload()}
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}
