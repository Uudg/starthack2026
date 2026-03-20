"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useGame } from "@/lib/store/game-context";
import EventModal from "./EventModal";
import RebalancePanel from "./RebalancePanel";
import NewsOverlay from "./NewsOverlay";
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
    elapsedSeconds,
    play,
    pause,
    setSpeed,
  } = useGame();

  const [showRebalance, setShowRebalance] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [activeTab, setActiveTab] = useState<"charts" | "allocation">("charts");
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Draggable terminal
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!terminalRef.current) return;
    dragging.current = true;
    const cs = window.getComputedStyle(terminalRef.current);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      left: parseFloat(cs.left) || 18,
      top: parseFloat(cs.top) || 18,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    terminalRef.current.classList.add("terminal--dragging");
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !terminalRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const rect = terminalRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    terminalRef.current.style.left = `${Math.max(8, Math.min(maxLeft, dragStart.current.left + dx))}px`;
    terminalRef.current.style.top = `${Math.max(8, Math.min(maxTop, dragStart.current.top + dy))}px`;
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    terminalRef.current?.classList.remove("terminal--dragging");
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove as any);
    window.addEventListener("pointerup", onPointerUp as any);
    return () => {
      window.removeEventListener("pointermove", onPointerMove as any);
      window.removeEventListener("pointerup", onPointerUp as any);
    };
  }, [onPointerMove, onPointerUp]);

  function finishIntro() {
    if (introRef.current) introRef.current.style.display = "none";
    if (loopRef.current) {
      loopRef.current.style.display = "block";
      loopRef.current.play().catch(() => {});
    }
    setIntroFinished(true);
  }

  if (!state) return null;

  const isPlaying = phase === "simulating";
  const drawdown = state.currentDrawdownPct ?? 0;
  const totalPortfolio = state.totalPortfolio ?? 0;
  const startValue = state.positions.reduce((s, p) => s + p.value, 0) || totalPortfolio;
  const returnPct = startValue > 0 ? ((totalPortfolio - startValue) / startValue) * 100 : 0;

  const yearLabel =
    currentYear <= 3 ? "GROWTH" : currentYear <= 5 ? "VOLATILITY" : currentYear <= 8 ? "RECOVERY" : "MATURITY";

  return (
    <div className="trading-screen scanlines">
      <div className="trading-screen__layout">
        {/* Video Scene */}
        <div className="trading-screen__room">
          <div className="trading-screen__video-stage">
            <video
              ref={introRef}
              className="trading-screen__bg-video"
              autoPlay
              muted
              playsInline
              onEnded={finishIntro}
            >
              <source src="/videos/1ch_beginning.mp4" type="video/mp4" />
            </video>
            <video
              ref={loopRef}
              className="trading-screen__bg-video"
              muted
              playsInline
              loop
              style={{ display: "none" }}
            >
              <source src="/videos/1ch_loop.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Phase badge */}
          <div className="trading-screen__phase">
            YEAR {currentYear} — {yearLabel}
          </div>

          {/* Season badge */}
          <div className="trading-screen__season">
            {drawdown > 10 ? "⚠ DRAWDOWN" : isPlaying ? "▶ SIMULATING" : "⏸ PAUSED"}
          </div>

          {/* Skip intro */}
          {!introFinished && (
            <button className="trading-screen__skip-intro" onClick={finishIntro}>
              SKIP INTRO
            </button>
          )}
        </div>

        {/* Draggable Terminal */}
        <div
          ref={terminalRef}
          className={`trading-screen__terminal${!introFinished ? " trading-screen__terminal--hidden" : " trading-screen__terminal--enter"}`}
        >
          <div className="terminal-monitor">
            <div className="terminal-bezel">
              <div className="terminal-screen">
                {/* Header */}
                <div className="terminal-header" onPointerDown={onPointerDown}>
                  <span className="terminal-header__title">▶ TRADING TERMINAL</span>
                  <span className="terminal-header__info">
                    Year {currentYear} • Week {((state.currentTick ?? 0) % 52) + 1}
                  </span>
                </div>

                {/* Tabs */}
                <div className="terminal-tabs">
                  <button
                    className={`terminal-tab${activeTab === "charts" ? " terminal-tab--active" : ""}`}
                    onClick={() => setActiveTab("charts")}
                  >
                    CHARTS
                  </button>
                  <button
                    className={`terminal-tab${activeTab === "allocation" ? " terminal-tab--active" : ""}`}
                    onClick={() => setActiveTab("allocation")}
                  >
                    ALLOCATION
                  </button>
                </div>

                {/* Panel Area */}
                <div className="terminal-panel-area">
                  {activeTab === "charts" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px", height: "100%" }}>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <div style={{ fontFamily: "var(--font-heading)", fontSize: "7px", color: "var(--muted-gray)", marginBottom: "4px", letterSpacing: "1px" }}>
                          PRICE PERFORMANCE
                        </div>
                        <PriceChart state={state} />
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <div style={{ fontFamily: "var(--font-heading)", fontSize: "7px", color: "var(--muted-gray)", marginBottom: "4px", letterSpacing: "1px" }}>
                          PORTFOLIO PROJECTION
                        </div>
                        {projection ? (
                          <ProjectionChart projection={projection} currentPortfolio={totalPortfolio} />
                        ) : (
                          <div style={{ fontFamily: "var(--font-body)", color: "var(--muted-gray)", padding: "16px", textAlign: "center" }}>
                            Calculating...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {activeTab === "allocation" && (
                    <div style={{ padding: "12px" }}>
                      <div style={{ fontFamily: "var(--font-heading)", fontSize: "8px", color: "var(--off-white)", marginBottom: "12px" }}>
                        CURRENT ALLOCATION
                      </div>
                      {state.positions.filter((p) => p.pct > 0).map((pos) => (
                        <div
                          key={pos.assetId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "6px 0",
                            borderBottom: "1px solid rgba(26,51,85,0.4)",
                          }}
                        >
                          <span style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--off-white)" }}>
                            {pos.assetId.split("_")[0].toUpperCase()}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "80px", height: "8px", background: "var(--terminal-bg)", border: "1px solid var(--panel-border)", overflow: "hidden" }}>
                              <div style={{ width: `${pos.pct}%`, height: "100%", background: ASSET_COLORS[pos.assetId] ?? "#4a6580" }} />
                            </div>
                            <span style={{ fontFamily: "var(--font-heading)", fontSize: "8px", color: ASSET_COLORS[pos.assetId] ?? "var(--off-white)", width: "32px", textAlign: "right" }}>
                              {pos.pct}%
                            </span>
                          </div>
                        </div>
                      ))}
                      <button
                        className="pixel-btn pixel-btn--ghost"
                        style={{ fontSize: "8px", padding: "8px 16px", marginTop: "12px", width: "100%" }}
                        onClick={() => setShowRebalance(true)}
                      >
                        ⚖ REBALANCE PORTFOLIO
                      </button>
                    </div>
                  )}
                </div>

                {/* Portfolio Summary */}
                <div className="portfolio-summary">
                  <div>
                    <div className="portfolio-summary__label">TOTAL VALUE</div>
                    <div className="portfolio-summary__value">{formatCHF(totalPortfolio)}</div>
                  </div>
                  <div className={`portfolio-summary__return ${returnPct >= 0 ? "portfolio-summary__return--up" : "portfolio-summary__return--down"}`}>
                    {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                  </div>
                  <div className="portfolio-summary__alloc-bar">
                    {state.positions.filter((p) => p.pct > 0).map((pos) => (
                      <div
                        key={pos.assetId}
                        className="alloc-segment"
                        style={{ flex: pos.pct, background: ASSET_COLORS[pos.assetId] ?? "#4a6580" }}
                        title={`${pos.assetId}: ${pos.pct}%`}
                      />
                    ))}
                  </div>
                </div>

                {/* News Ticker */}
                <div className="news-ticker">
                  <span className="news-ticker__badge">MARKET</span>
                  <span className="news-ticker__content">
                    {historicalNews
                      ? `📰 ${historicalNews.name}`
                      : `Year ${currentYear} • Portfolio: ${formatCHF(totalPortfolio)} • ${isPlaying ? "Simulating..." : "Paused"}`}
                  </span>
                </div>

                {/* Controls */}
                <div className="terminal-controls">
                  <div className="terminal-status">
                    Year {currentYear} • Week {((state.currentTick ?? 0) % 52) + 1} • {formatCHF(totalPortfolio)}
                  </div>
                  <div className="terminal-progress">
                    <div className="terminal-progress__fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    <button
                      className={`pixel-btn ${isPlaying ? "pixel-btn--red" : "pixel-btn--blue"}`}
                      style={{ fontSize: "8px", padding: "6px 12px" }}
                      onClick={isPlaying ? pause : play}
                    >
                      {isPlaying ? "⏸" : "▶"} {isPlaying ? "PAUSE" : "PLAY"}
                    </button>
                    {([1, 3, 5] as const).map((s) => (
                      <button
                        key={s}
                        className="pixel-btn pixel-btn--ghost"
                        style={{ fontSize: "8px", padding: "6px 10px" }}
                        onClick={() => setSpeed(s)}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* News overlay (banner + popup) */}
      <NewsOverlay />

      {/* Event modal */}
      {phase === "event" && <EventModal />}

      {/* Rebalance panel */}
      {showRebalance && <RebalancePanel onClose={() => setShowRebalance(false)} />}
    </div>
  );
}
