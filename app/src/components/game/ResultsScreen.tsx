"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  panic_seller: "#ff4444",
  cash_hoarder: "#ffab40",
  overthinker: "#ce93d8",
  strategist: "#00e676",
  diamond_hands: "#40c4ff",
  momentum_chaser: "#ffd700",
};

const RANK_TROPHIES: Record<number, string> = {
  1: "\u{1F451}",
  2: "\u{1F948}",
  3: "\u{1F949}",
};

const BAR_COLORS = ["#40c4ff", "#ffab40", "#ff1744", "#00e676"];

function formatCHF(v: number): string {
  return `CHF ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/* ── Animated count-up number ── */
function CountUp({
  target,
  duration = 2000,
  delay = 0,
}: {
  target: number;
  duration?: number;
  delay?: number;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return <>{current}</>;
}

/* ── Animated bar fill ── */
function ScoreBar({
  label,
  value,
  max,
  color,
  delay,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  delay: number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setWidth(Math.round((value / max) * 100));
    }, delay);
    return () => clearTimeout(t);
  }, [value, max, delay]);

  return (
    <div className="results-score-bar">
      <span className="results-score-bar__label">
        {label} ({value}/{max})
      </span>
      <div className="results-score-bar__track">
        <div
          className="results-score-bar__fill"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ── Lesson chest card ── */
function LessonChestCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`lesson-chest${open ? " lesson-chest--open" : ""}`}
      onClick={() => setOpen(true)}
    >
      <div className="lesson-chest__icon">{open ? "\u{1F4D6}" : icon}</div>
      <div className="lesson-chest__title">{title}</div>
      {open ? (
        <div className="lesson-chest__text">{text}</div>
      ) : (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--muted-gray)",
          }}
        >
          CLICK TO OPEN
        </div>
      )}
    </div>
  );
}

/* ================================================================
   RESULTS SCREEN
   ================================================================ */
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (seedData?.seed.id) {
      fetchLeaderboard(seedData.seed.id);
    } else {
      fetchLeaderboard();
    }
  }, []);

  // Auto-play video
  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  if (!state || !compositeScore || !behavioralProfile) return null;

  const profile = getProfileDisplay(behavioralProfile, {
    finalPortfolio: state.totalPortfolio,
    benchmarkFinal: benchmarkFinal ?? state.totalPortfolio,
    totalRebalances: state.totalRebalances,
    cashHeavyWeeks: state.cashHeavyWeeks,
  });

  const scoreNormalized = Math.round(compositeScore);
  const delta = state.totalPortfolio - (benchmarkFinal ?? state.totalPortfolio);
  const beatBenchmark = delta >= 0;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  // Score breakdown (same proportions as demo-app)
  const diversification = Math.round(scoreNormalized * 0.25);
  const riskAlignment = Math.round(scoreNormalized * 0.25);
  const crashBehaviour = Math.round(scoreNormalized * 0.3);
  const returnVsBenchmark = Math.round(scoreNormalized * 0.2);

  // Lesson text generation (matching demo-app logic)
  const startVal = Math.max(state.baseContribution ?? 100000, 1);
  const portfolioVal = Math.max(0, state.totalPortfolio);
  const minPortfolioValue = Math.min(portfolioVal, startVal * 0.7);
  const drawdownPct = Math.min(
    100,
    Math.max(0, Math.round(((startVal - minPortfolioValue) / startVal) * 100))
  );
  const recoveryDenom = Math.max(minPortfolioValue, startVal * 0.05, 1);
  const recoveryPct = Math.min(
    999,
    Math.max(
      0,
      Math.round(((portfolioVal - minPortfolioValue) / recoveryDenom) * 100)
    )
  );
  const crashBottomValue = Math.round(startVal * 0.65);

  const drawdownText = `Your portfolio dropped ${drawdownPct}% at its lowest point. That's called a drawdown — the gap between the highest and lowest value. Investors who held through it recovered ${recoveryPct}% more than those who sold at the bottom.`;
  const diversificationText = `Spreading investments across different assets means they don't all fall at once. Your diversification score was ${diversification}/25 — the more balanced your allocation, the better you weathered volatility.`;
  const timeInMarketText = `If you'd sold at the crash bottom and stayed in cash, you'd have about ${formatCHF(crashBottomValue)} today instead of ${formatCHF(Math.round(portfolioVal))}. Staying invested through the crash was worth ${formatCHF(Math.round(portfolioVal - crashBottomValue))}. "Time in the market" beats timing the market.`;

  // Score color
  const scoreColor =
    scoreNormalized >= 85
      ? "#ffd700"
      : scoreNormalized >= 65
      ? "#00e676"
      : scoreNormalized >= 40
      ? "#ffab40"
      : "#ff1744";

  const profileColor = PROFILE_COLORS[behavioralProfile] ?? "#aaa";

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "var(--deep-navy)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      {/* Starfield background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(2px 2px at 20% 15%, rgba(255,215,0,0.25) 1px, transparent 2px)," +
            "radial-gradient(2px 2px at 75% 25%, rgba(0,255,135,0.2) 1px, transparent 2px)," +
            "radial-gradient(2px 2px at 45% 60%, rgba(64,196,255,0.2) 1px, transparent 2px)," +
            "radial-gradient(2px 2px at 90% 70%, rgba(255,215,0,0.2) 1px, transparent 2px)," +
            "radial-gradient(1px 1px at 10% 80%, rgba(255,255,255,0.15) 1px, transparent 2px)," +
            "radial-gradient(1px 1px at 60% 10%, rgba(255,255,255,0.1) 1px, transparent 2px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          display: "flex",
          flexDirection: "column",
          gap: "0",
          position: "relative",
          zIndex: 1,
          padding: "0 24px 56px",
        }}
      >
        {/* ── 1. BANNER ── */}
        <div className="results-banner">
          <h1 className="results-banner__title">SIMULATION COMPLETE</h1>
          {seedData?.seed.name && (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "18px",
                color: "var(--muted-gray-light)",
                marginTop: "8px",
                letterSpacing: "2px",
              }}
            >
              {seedData.seed.name}
            </div>
          )}
          {/* Decorative line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            <span
              style={{
                width: "80px",
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, var(--pixel-gold), transparent)",
              }}
            />
            <span
              style={{
                width: "8px",
                height: "8px",
                background: "var(--pixel-gold)",
                transform: "rotate(45deg)",
                boxShadow: "0 0 8px var(--pixel-gold-glow)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: "80px",
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, var(--pixel-gold), transparent)",
              }}
            />
          </div>
        </div>

        {/* ── 2. TOP SECTION: Video + Score ── */}
        <div className="results-top" style={{ marginBottom: "32px" }}>
          {/* Video with CRT filter */}
          <div className="results-top__video">
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter:
                  "sepia(0.1) saturate(0.8) contrast(0.9) brightness(0.5)",
              }}
            >
              <source src="/videos/1ch_loop.mp4" type="video/mp4" />
            </video>
            {/* CRT scanlines overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Score section */}
          <div className="results-score-section">
            {/* Large animated score number */}
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "10px",
                  color: "var(--muted-gray)",
                  letterSpacing: "2px",
                  marginBottom: "8px",
                }}
              >
                YOUR SCORE
              </div>
              <div
                className="results-score__number"
                style={{ color: scoreColor }}
              >
                <CountUp target={scoreNormalized} duration={2000} delay={600} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "14px",
                  color: "var(--muted-gray)",
                  marginBottom: "12px",
                }}
              >
                / 100
              </div>
            </div>

            {/* 4 Score breakdown bars */}
            <div className="results-score__bars">
              <ScoreBar
                label="DIVERSIFICATION"
                value={diversification}
                max={25}
                color={BAR_COLORS[0]}
                delay={800}
              />
              <ScoreBar
                label="RISK ALIGNMENT"
                value={riskAlignment}
                max={25}
                color={BAR_COLORS[1]}
                delay={1000}
              />
              <ScoreBar
                label="CRASH BEHAVIOUR"
                value={crashBehaviour}
                max={30}
                color={BAR_COLORS[2]}
                delay={1200}
              />
              <ScoreBar
                label="RETURN vs BENCHMARK"
                value={returnVsBenchmark}
                max={20}
                color={BAR_COLORS[3]}
                delay={1400}
              />
            </div>
          </div>
        </div>

        {/* ── 3. BEHAVIORAL PROFILE CARD ── */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(12,21,32,0.95), rgba(10,14,26,0.98))",
            border: `2px solid ${profileColor}`,
            boxShadow: `0 0 24px ${profileColor}44`,
            textAlign: "center",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>
            {profile.icon}
          </div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              color: profileColor,
              marginBottom: "12px",
              letterSpacing: "2px",
              textShadow: `0 0 8px ${profileColor}40`,
            }}
          >
            {profile.name}
          </h2>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "20px",
              color: "var(--off-white)",
              maxWidth: "600px",
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            {profile.description}
          </div>
        </div>

        {/* ── 4. DIVIDER WITH DIAMOND ── */}
        <div className="results-divider">
          {"━━━ \u25C6 ━━━"}
        </div>

        {/* ── 5. LESSON CHESTS ── */}
        <div style={{ marginBottom: "32px" }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "12px",
              color: "var(--pixel-gold)",
              textAlign: "center",
              marginBottom: "20px",
              letterSpacing: "3px",
              textShadow: "0 0 12px var(--pixel-gold-glow)",
            }}
          >
            {"━━━ LESSONS LEARNED ━━━"}
          </h3>
          <div className="results-lessons">
            <LessonChestCard
              icon={"\u{1F4E6}"}
              title="YOUR DRAWDOWN"
              text={drawdownText}
            />
            <LessonChestCard
              icon={"\u{1F4E6}"}
              title="DIVERSIFICATION"
              text={diversificationText}
            />
            <LessonChestCard
              icon={"\u{1F4E6}"}
              title="TIME IN MARKET"
              text={timeInMarketText}
            />
          </div>
        </div>

        {/* ── 6. KEY METRICS ROW ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "32px",
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
              label: "TIME",
              value: `${minutes}:${seconds.toString().padStart(2, "0")}`,
              color: "var(--off-white)",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                background: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                padding: "12px 8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "7px",
                  color: "var(--muted-gray)",
                  marginBottom: "6px",
                  letterSpacing: "0.5px",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(9px, 1.2vw, 13px)",
                  color: item.color,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── 7. LEADERBOARD ── */}
        {entries.length > 0 && (
          <div className="results-leaderboard" style={{ marginBottom: "32px" }}>
            <h3 className="results-leaderboard__title">
              GLOBAL LEADERBOARD
            </h3>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th style={{ width: "52px", textAlign: "center" }}>#</th>
                  <th>PLAYER</th>
                  <th>PROFILE</th>
                  <th style={{ textAlign: "right" }}>SCORE</th>
                  <th style={{ textAlign: "right" }}>FINAL</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 10).map((entry, i) => {
                  const isMe = entry.session_id === sessionId;
                  const rank = i + 1;
                  const trophy = RANK_TROPHIES[rank];
                  const rowClass = isMe
                    ? "leaderboard-row--current"
                    : rank === 1
                    ? "leaderboard-row--gold"
                    : rank === 2
                    ? "leaderboard-row--silver"
                    : rank === 3
                    ? "leaderboard-row--bronze"
                    : "";

                  const entryProfileColor =
                    PROFILE_COLORS[entry.behavioral_profile] ?? "#aaa";

                  return (
                    <tr key={entry.session_id} className={rowClass}>
                      <td style={{ textAlign: "center" }}>
                        {trophy ? (
                          <span style={{ fontSize: "18px" }}>{trophy}</span>
                        ) : (
                          rank
                        )}
                      </td>
                      <td>
                        <span style={{ marginRight: "8px" }}>
                          {entry.avatar || "\u{1F3AE}"}
                        </span>
                        {entry.nickname}
                        {isMe && (
                          <span
                            style={{
                              display: "inline-block",
                              fontFamily: "var(--font-heading)",
                              fontSize: "6px",
                              color: "#0a0e1a",
                              background: "var(--pixel-green)",
                              padding: "2px 6px",
                              marginLeft: "8px",
                              verticalAlign: "middle",
                              letterSpacing: "1px",
                            }}
                          >
                            YOU
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "16px",
                            color: entryProfileColor,
                            borderColor: `${entryProfileColor}30`,
                          }}
                        >
                          {entry.behavioral_profile
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "13px",
                            color: "var(--pixel-gold)",
                            textShadow: "0 0 6px var(--pixel-gold-glow)",
                          }}
                        >
                          {Math.round(entry.composite_score)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {formatCHF(entry.final_portfolio)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 8. PLAY AGAIN ── */}
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
