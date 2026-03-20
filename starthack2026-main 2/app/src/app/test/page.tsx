"use client";

import { useState, useEffect, useRef } from "react";
import { GameProvider, useGame } from "@/lib/store/game-context";
import { CoachPopup } from "@/components/CoachPopup";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useSeedData } from "@/lib/hooks/useSeedData";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { tickSimulation } from "@/lib/engine/simulation";
import { LIFE_EVENTS } from "@/lib/engine/events";
import {
  calculateCompositeScore,
  detectBehavioralProfile,
} from "@/lib/engine/scoring";
import type { SimulationState } from "@/lib/types";
import type { ProjectionResult } from "@/lib/engine/projection";

const DEFAULT_ALLOCATIONS = [
  { assetId: "smi", pct: 40 },
  { assetId: "ch_bond", pct: 20 },
  { assetId: "gold_chf", pct: 15 },
  { assetId: "nestle", pct: 15 },
  { assetId: "cash", pct: 10 },
];

const REBALANCE_ALLOCATIONS = [
  { assetId: "smi", pct: 80 },
  { assetId: "ch_bond", pct: 10 },
  { assetId: "gold_chf", pct: 5 },
  { assetId: "cash", pct: 5 },
];

// ── Shared styles ──────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: "monospace",
    fontSize: 13,
    padding: "24px 32px",
    maxWidth: 860,
    margin: "0 auto",
    background: "#fafafa",
    color: "#1a1a1a",
  } as React.CSSProperties,
  card: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: "16px 20px",
    marginBottom: 16,
  } as React.CSSProperties,
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  } as React.CSSProperties,
  h2: {
    margin: 0,
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "#333",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
    marginBottom: 8,
  } as React.CSSProperties,
  label: { color: "#666", minWidth: 120 } as React.CSSProperties,
  value: { color: "#111", fontWeight: "bold" } as React.CSSProperties,
  btn: (disabled?: boolean, variant?: "primary" | "danger" | "warning") => ({
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "5px 12px",
    border: "1px solid",
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: 12,
    opacity: disabled ? 0.45 : 1,
    background:
      variant === "primary"
        ? "#1a6ef5"
        : variant === "danger"
          ? "#e53e3e"
          : variant === "warning"
            ? "#d97706"
            : "#fff",
    color:
      variant === "primary" || variant === "danger" || variant === "warning"
        ? "#fff"
        : "#333",
    borderColor:
      variant === "primary"
        ? "#1a6ef5"
        : variant === "danger"
          ? "#e53e3e"
          : variant === "warning"
            ? "#d97706"
            : "#bbb",
  }),
  badge: (color: "green" | "orange" | "red" | "blue" | "gray") => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: "bold",
    background:
      color === "green"
        ? "#d1fae5"
        : color === "orange"
          ? "#fef3c7"
          : color === "red"
            ? "#fee2e2"
            : color === "blue"
              ? "#dbeafe"
              : "#f3f4f6",
    color:
      color === "green"
        ? "#065f46"
        : color === "orange"
          ? "#92400e"
          : color === "red"
            ? "#991b1b"
            : color === "blue"
              ? "#1e40af"
              : "#6b7280",
  }),
  pre: {
    background: "#1e1e1e",
    color: "#d4d4d4",
    padding: 12,
    borderRadius: 4,
    fontSize: 11,
    maxHeight: 220,
    overflow: "auto",
    margin: "8px 0 0 0",
  } as React.CSSProperties,
  hint: { color: "#888", fontSize: 11, marginTop: 4 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid #e5e7eb", margin: "4px 0 12px 0" } as React.CSSProperties,
  note: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 4,
    padding: "6px 10px",
    fontSize: 11,
    color: "#78350f",
    marginBottom: 10,
  } as React.CSSProperties,
  success: {
    background: "#ecfdf5",
    border: "1px solid #6ee7b7",
    borderRadius: 4,
    padding: "6px 10px",
    fontSize: 11,
    color: "#064e3b",
    marginBottom: 6,
  } as React.CSSProperties,
  error: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 4,
    padding: "6px 10px",
    fontSize: 11,
    color: "#7f1d1d",
    marginBottom: 6,
  } as React.CSSProperties,
} as const;

function Badge({ text, color }: { text: string; color: "green" | "orange" | "red" | "blue" | "gray" }) {
  return <span style={S.badge(color)}>{text}</span>;
}

function Btn({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "warning";
  children: React.ReactNode;
}) {
  return (
    <button style={S.btn(disabled, variant)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value}</span>
    </div>
  );
}

// ── Projection Cone Chart ─────────────────────────────────────────────────

function ProjectionCone({
  projection,
  currentPortfolio,
}: {
  projection: ProjectionResult;
  currentPortfolio: number;
}) {
  const W = 620;
  const H = 200;
  const PAD = { top: 12, right: 16, bottom: 28, left: 62 };

  const { p5, p25, p50, p75, p95 } = projection.percentiles;
  const n = p50.length;
  if (n === 0) return null;

  // Prepend current portfolio so the cone starts from now
  const s = {
    p5:  [currentPortfolio, ...p5],
    p25: [currentPortfolio, ...p25],
    p50: [currentPortfolio, ...p50],
    p75: [currentPortfolio, ...p75],
    p95: [currentPortfolio, ...p95],
  };
  const total = n + 1;

  const minY = Math.min(...s.p5)  * 0.96;
  const maxY = Math.max(...s.p95) * 1.04;

  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top  - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (total - 1)) * cw;
  const y = (v: number) => PAD.top  + ch - ((v - minY) / (maxY - minY)) * ch;

  const line = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const band = (top: number[], bot: number[]) => {
    const fwd = top.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const bwd = [...bot].reverse().map((v, i) =>
      `L${x(bot.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`
    ).join(" ");
    return `${fwd} ${bwd} Z`;
  };

  const fmt = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}k`
    : v.toFixed(0);

  // Y gridlines: 5 evenly spaced
  const yTicks = Array.from({ length: 5 }, (_, i) => minY + (i / 4) * (maxY - minY));

  // X labels: every 13 monthly points ≈ 1 year
  const xTicks: number[] = [];
  for (let i = 0; i < total; i += 13) xTicks.push(i);
  if (xTicks[xTicks.length - 1] !== total - 1) xTicks.push(total - 1);

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#555", marginBottom: 4, alignItems: "center" }}>
        <span>
          <svg width={12} height={12} style={{ verticalAlign: "middle", marginRight: 3 }}>
            <rect width={12} height={12} fill="#3b82f6" opacity={0.18} />
          </svg>
          P5–P95
        </span>
        <span>
          <svg width={12} height={12} style={{ verticalAlign: "middle", marginRight: 3 }}>
            <rect width={12} height={12} fill="#3b82f6" opacity={0.38} />
          </svg>
          P25–P75
        </span>
        <span>
          <svg width={16} height={4} style={{ verticalAlign: "middle", marginRight: 3 }}>
            <line x1={0} y1={2} x2={16} y2={2} stroke="#1d4ed8" strokeWidth={2} />
          </svg>
          Median (P50)
        </span>
        <span style={{ marginLeft: "auto", color: "#1d4ed8", fontWeight: "bold" }}>
          Median final: CHF {fmt(projection.medianFinal)} · Beat-target prob: {projection.targetProbability}%
        </span>
      </div>

      <svg
        width={W}
        height={H}
        style={{ display: "block", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 4 }}
      >
        {/* Y gridlines + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={y(v).toFixed(1)}
              x2={PAD.left + cw} y2={y(v).toFixed(1)}
              stroke="#f0f0f0" strokeWidth={1}
            />
            <text
              x={PAD.left - 5} y={y(v)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={9} fill="#888"
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X axis ticks + labels */}
        {xTicks.map((i) => {
          const yr = Math.round(i / 13);
          return (
            <g key={i}>
              <line
                x1={x(i).toFixed(1)} y1={PAD.top + ch}
                x2={x(i).toFixed(1)} y2={PAD.top + ch + 4}
                stroke="#bbb" strokeWidth={1}
              />
              <text
                x={x(i)} y={PAD.top + ch + 14}
                textAnchor="middle" fontSize={9} fill="#888"
              >
                {yr === 0 ? "now" : `Yr ${yr}`}
              </text>
            </g>
          );
        })}

        {/* Bands */}
        <path d={band(s.p95, s.p5)}  fill="#3b82f6" opacity={0.18} />
        <path d={band(s.p75, s.p25)} fill="#3b82f6" opacity={0.38} />

        {/* Median line */}
        <path d={line(s.p50)} fill="none" stroke="#1d4ed8" strokeWidth={2} />

        {/* "Now" dot */}
        <circle cx={x(0)} cy={y(currentPortfolio)} r={4} fill="#1d4ed8" />

        {/* Chart border */}
        <rect
          x={PAD.left} y={PAD.top} width={cw} height={ch}
          fill="none" stroke="#e5e7eb" strokeWidth={1}
        />
      </svg>
    </div>
  );
}

// ── Main Content ───────────────────────────────────────────────────────────

function TestPageContent() {
  const game = useGame();
  const { player, loading: playerLoading, createPlayer } = usePlayer();
  const {
    seedData,
    availableSeeds,
    loading: seedLoading,
    error: seedError,
    fetchSeeds,
    fetchSeedData,
  } = useSeedData();
  const { entries, loading: lbLoading, fetchLeaderboard } = useLeaderboard();

  const [output, setOutput] = useState<Record<string, unknown>>({});
  const [skipToEndResult, setSkipToEndResult] = useState<Record<string, unknown> | null>(null);
  const [rebalanceResult, setRebalanceResult] = useState<{ before: number; after: number } | null>(null);
  const [seedValidation, setSeedValidation] = useState<{ pass: boolean; details: string } | null>(null);
  const [liveState, setLiveState] = useState<Record<string, unknown>>({});
  const [activeSpeed, setActiveSpeed] = useState<1 | 3 | 5>(3);

  // Portfolio management
  const [allocInputs, setAllocInputs] = useState<Record<string, number>>({});
  const allocInitialized = useRef(false);
  const [rebalanceMsg, setRebalanceMsg] = useState<string | null>(null);

  // Auto-initialize allocation inputs once when game state first appears
  useEffect(() => {
    if (game.state && !allocInitialized.current) {
      const init: Record<string, number> = {};
      for (const pos of game.state.positions) init[pos.assetId] = pos.pct;
      setAllocInputs(init);
      allocInitialized.current = true;
    }
    // Reset on new game
    if (!game.state) allocInitialized.current = false;
  }, [game.state]);

  // Auto-update live state every 500ms
  useEffect(() => {
    const id = setInterval(() => {
      setLiveState({
        phase: game.phase,
        tick: `${game.state?.currentTick ?? 0} / ${game.state?.totalTicks ?? 0}`,
        year: game.currentYear,
        weekInYear: game.currentWeekInYear,
        progress: game.progressPct.toFixed(1) + "%",
        totalPortfolio: game.state?.totalPortfolio?.toFixed(2),
        positions: game.state?.positions?.map((p) => ({
          asset: p.assetId,
          pct: p.pct + "%",
          value: "CHF " + p.value.toFixed(0),
        })),
        effectiveContribution: game.state?.effectiveContribution,
        triggeredEvents: game.state?.triggeredEvents?.length ?? 0,
        maxDrawdownPct: game.state?.maxDrawdownPct?.toFixed(2) + "%",
        elapsedSeconds: game.elapsedSeconds,
        historicalNews: game.historicalNews?.name ?? null,
        activeEvent: game.activeEvent?.title ?? null,
        compositeScore: game.compositeScore,
        behavioralProfile: game.behavioralProfile,
      });
    }, 500);
    return () => clearInterval(id);
  }, [game]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreatePlayer = async () => {
    try {
      const p = await createPlayer("TestPlayer", "🐻");
      console.log("Created player:", p);
      setOutput((prev) => ({ ...prev, player: p }));
    } catch (e) {
      console.error(e);
      setOutput((prev) => ({ ...prev, playerError: String(e) }));
    }
  };

  const handleFetchSeeds = async () => {
    try {
      const seeds = await fetchSeeds();
      console.log("Seeds:", seeds);
      setOutput((prev) => ({ ...prev, seeds }));
    } catch (e) {
      console.error(e);
      setOutput((prev) => ({ ...prev, seedsError: String(e) }));
    }
  };

  const handleLoadSeed = async (seedId: string) => {
    try {
      const data = await fetchSeedData(seedId);
      if (!data) return;
      const priceArrays = Object.values(data.prices);
      const lengths = priceArrays.map((arr) => arr.length);
      const allSameLength = lengths.every((l) => l === lengths[0]);
      const hasNaN = priceArrays.some((arr) => arr.some((v) => isNaN(v)));
      const pass = allSameLength && !hasNaN;
      setSeedValidation({
        pass,
        details: `${data.assets.length} assets · ${lengths[0] ?? 0} price points each · ${data.dates[0]} → ${data.dates[data.dates.length - 1]} · allSameLength=${allSameLength} · hasNaN=${hasNaN}`,
      });
      console.log("Seed loaded:", data);
      setOutput((prev) => ({ ...prev, seedLoaded: { name: data.seed.name, ...{ allSameLength, hasNaN, pass } } }));
    } catch (e) {
      console.error(e);
      setOutput((prev) => ({ ...prev, seedLoadError: String(e) }));
    }
  };

  const handleStartGame = async () => {
    if (!player || !seedData) return;
    try {
      await game.startGame({
        playerId: player.id,
        seed: seedData.seed,
        assets: seedData.assets,
        prices: seedData.prices,
        startingPortfolio: 10000,
        monthlyContribution: 200,
        allocations: DEFAULT_ALLOCATIONS,
      });
      setActiveSpeed(3);
      console.log("Game started, sessionId:", game.sessionId);
      setOutput((prev) => ({ ...prev, gameStarted: { sessionId: game.sessionId, benchmark: game.benchmarkFinal } }));
    } catch (e) {
      console.error(e);
      setOutput((prev) => ({ ...prev, startGameError: String(e) }));
    }
  };

  const handleRunTenTicks = () => {
    game.play();
    setTimeout(() => game.pause(), 10 * 270 + 100);
  };

  const handleRebalanceTest = () => {
    const before = game.state?.totalPortfolio ?? 0;
    game.rebalance(REBALANCE_ALLOCATIONS);
    setTimeout(() => {
      const after = game.state?.totalPortfolio ?? 0;
      setRebalanceResult({ before, after });
      console.log("Rebalance:", { before, after });
      setOutput((prev) => ({ ...prev, rebalance: { before, after, note: "values should be identical — only allocation % changed" } }));
    }, 50);
  };

  const handleShowNextEvent = () => {
    const next = game.state?.scheduledEvents?.[0];
    if (!next) {
      setOutput((prev) => ({ ...prev, nextEvent: "no scheduled events remaining" }));
      return;
    }
    const def = LIFE_EVENTS[next.key];
    const info = {
      scheduledAtTick: next.tick,
      chain: next.chain,
      key: next.key,
      title: def?.title,
      description: def?.description,
      optionA: def ? `${def.optionA.label} — ${def.optionA.effect.description}` : undefined,
      optionB: def ? `${def.optionB.label} — ${def.optionB.effect.description}` : undefined,
    };
    console.log("Next event:", info);
    setOutput((prev) => ({ ...prev, nextEvent: info }));
  };

  const handleChooseOption = async (chosen: "a" | "b") => {
    if (!game.activeEvent) return;
    const before = game.state?.totalPortfolio ?? 0;
    const contribBefore = game.state?.effectiveContribution ?? 0;
    await game.chooseEventOption(chosen);
    setTimeout(() => {
      const result = {
        chosen,
        portfolioBefore: before.toFixed(2),
        portfolioAfter: (game.state?.totalPortfolio ?? 0).toFixed(2),
        contributionBefore: contribBefore,
        contributionAfter: game.state?.effectiveContribution,
      };
      console.log("Event choice:", result);
      setOutput((prev) => ({ ...prev, eventChoice: result }));
    }, 100);
  };

  const handleSkipToEnd = async () => {
    if (!game.state || !seedData) return;
    game.pause();

    let simState: SimulationState = game.state;
    const seed = seedData.seed;
    let ticks = 0;

    while (simState.currentTick < simState.totalTicks) {
      const result = tickSimulation(simState, seed);
      simState = result.state;
      ticks++;
      if (result.isComplete) break;
    }

    const totalContributed = simState.baseContribution * Math.floor(simState.totalTicks / 4);
    const bFinal = game.benchmarkFinal ?? simState.totalPortfolio;
    const scoringInput = {
      finalPortfolio: simState.totalPortfolio,
      startingPortfolio: 10000,
      totalContributed,
      benchmarkFinal: bFinal,
      totalRebalances: simState.totalRebalances,
      panicRebalances: simState.panicRebalances,
      cashHeavyWeeks: simState.cashHeavyWeeks,
      totalWeeks: simState.totalTicks,
      maxDrawdownPct: simState.maxDrawdownPct,
      chainState: simState.chainState,
      triggeredEvents: simState.triggeredEvents,
    };
    const score = calculateCompositeScore(scoringInput);
    const profile = detectBehavioralProfile(scoringInput);
    const summary = {
      finalPortfolio: simState.totalPortfolio,
      benchmark: bFinal,
      compositeScore: score,
      behavioralProfile: profile,
      ticksRun: ticks,
      totalTriggeredEvents: simState.triggeredEvents.length,
    };
    console.log("Skip to end:", summary);
    setSkipToEndResult(summary as Record<string, unknown>);

    if (game.sessionId) {
      try {
        const res = await fetch(`/api/sessions/${game.sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalPortfolio: simState.totalPortfolio,
            benchmarkFinal: bFinal,
            behavioralProfile: profile,
            compositeScore: score,
            totalRebalances: simState.totalRebalances,
            panicRebalances: simState.panicRebalances,
            cashHeavyWeeks: simState.cashHeavyWeeks,
            maxDrawdownPct: simState.maxDrawdownPct,
            chainState: simState.chainState,
            durationSeconds: game.elapsedSeconds,
            snapshots: [],
          }),
        });
        const apiData = await res.json();
        console.log("Session saved:", apiData);
        setOutput((prev) => ({ ...prev, sessionSaved: apiData }));
      } catch (e) {
        setOutput((prev) => ({ ...prev, sessionSaveError: String(e) }));
      }
    }
  };

  const handleFetchLeaderboard = async () => {
    await fetchLeaderboard(seedData?.seed.id);
  };

  // ── Portfolio management ────────────────────────────────────────────────────

  const allocSum = Object.values(allocInputs).reduce((s, v) => s + v, 0);
  const allocOk = Math.abs(allocSum - 100) < 0.5;

  const syncAllocsFromState = () => {
    if (!game.state) return;
    const next: Record<string, number> = {};
    for (const pos of game.state.positions) next[pos.assetId] = pos.pct;
    setAllocInputs(next);
    setRebalanceMsg(null);
  };

  const applyPreset = (preset: Array<{ assetId: string; pct: number }>) => {
    if (!game.state) return;
    // Only apply to assets currently in the portfolio
    const assetIds = new Set(game.state.positions.map((p) => p.assetId));
    const next: Record<string, number> = {};
    for (const pos of game.state.positions) next[pos.assetId] = 0;
    for (const { assetId, pct } of preset) {
      if (assetIds.has(assetId)) next[assetId] = pct;
    }
    setAllocInputs(next);
    setRebalanceMsg(null);
  };

  const handleApplyRebalance = () => {
    if (!game.state || !allocOk) return;
    const allocs = Object.entries(allocInputs).map(([assetId, pct]) => ({ assetId, pct }));
    game.rebalance(allocs);
    setRebalanceMsg(`✅ Rebalanced at tick ${game.state.currentTick}. Portfolio redistributed — total value unchanged.`);
    console.log("Manual rebalance applied:", allocs);
  };

  const PRESETS = {
    conservative: [
      { assetId: "smi", pct: 15 },
      { assetId: "ch_bond", pct: 50 },
      { assetId: "gold_chf", pct: 10 },
      { assetId: "nestle", pct: 5 },
      { assetId: "cash", pct: 20 },
    ],
    balanced: DEFAULT_ALLOCATIONS,
    aggressive: [
      { assetId: "smi", pct: 65 },
      { assetId: "ch_bond", pct: 5 },
      { assetId: "gold_chf", pct: 10 },
      { assetId: "nestle", pct: 20 },
      { assetId: "cash", pct: 0 },
    ],
    allCash: [
      { assetId: "smi", pct: 0 },
      { assetId: "ch_bond", pct: 0 },
      { assetId: "gold_chf", pct: 0 },
      { assetId: "nestle", pct: 0 },
      { assetId: "cash", pct: 100 },
    ],
  };

  // Build asset name lookup from seedData
  const assetNameMap = Object.fromEntries(
    (seedData?.assets ?? []).map((a) => [a.id, a.name])
  );

  // ── Derived state ──────────────────────────────────────────────────────────

  const canStartGame = !!player && !!seedData && game.phase === "idle";
  const isPlaying = game.phase === "simulating";
  const hasState = !!game.state;
  const hasActiveEvent = !!game.activeEvent;

  const phaseColor =
    game.phase === "simulating" ? "green"
    : game.phase === "event" ? "orange"
    : game.phase === "results" || game.phase === "completing" ? "blue"
    : game.phase === "idle" ? "gray"
    : "orange";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: "bold" }}>🧪 Game Logic Test Page</h1>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 12 }}>
          Walk through each section in order. Output goes to page + <code>console.log</code>.
        </p>
      </div>

      {/* ── STEP 1: Player ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>1️⃣</span>
          <h2 style={S.h2}>Player</h2>
          <Badge
            text={playerLoading ? "loading…" : player ? "✓ detected" : "not set"}
            color={player ? "green" : playerLoading ? "orange" : "gray"}
          />
        </div>
        <hr style={S.divider} />

        {player ? (
          <KV
            label="Current player"
            value={`${player.avatar} ${player.nickname}  [${player.id.slice(0, 8)}…]`}
          />
        ) : (
          <p style={S.hint}>No player detected in localStorage. Create one below.</p>
        )}

        <div style={S.row}>
          <Btn onClick={handleCreatePlayer} variant="primary">
            Create Test Player (nickname=TestPlayer, avatar=🐻)
          </Btn>
        </div>
      </div>

      {/* ── STEP 2: Seed Data ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>2️⃣</span>
          <h2 style={S.h2}>Seed Data</h2>
          <Badge
            text={seedLoading ? "loading…" : seedData ? `✓ loaded: ${seedData.seed.name}` : "not loaded"}
            color={seedData ? "green" : seedLoading ? "orange" : "gray"}
          />
        </div>
        <hr style={S.divider} />

        {seedError && <div style={S.error}>Error: {seedError}</div>}

        <div style={S.row}>
          <Btn onClick={handleFetchSeeds}>1. Fetch Seeds</Btn>
          <span style={S.hint}>→ then load one below</span>
        </div>

        {availableSeeds.length > 0 && (
          <div style={S.row}>
            {availableSeeds.map((seed) => (
              <Btn
                key={seed.id}
                onClick={() => handleLoadSeed(seed.id)}
                variant={seedData?.seed.id === seed.id ? "primary" : undefined}
              >
                2. Load "{seed.name}" ({seed.difficulty})
              </Btn>
            ))}
          </div>
        )}

        {seedValidation && (
          <div style={seedValidation.pass ? S.success : S.error}>
            {seedValidation.pass ? "✅ PASS" : "❌ FAIL"} — {seedValidation.details}
          </div>
        )}
      </div>

      {/* ── STEP 3: Engine ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>3️⃣</span>
          <h2 style={S.h2}>Game Engine</h2>
          <Badge text={game.phase} color={phaseColor} />
          {game.sessionId && (
            <span style={{ ...S.hint, marginLeft: 8 }}>
              session: {game.sessionId.slice(0, 8)}…
            </span>
          )}
        </div>
        <hr style={S.divider} />

        {!player || !seedData ? (
          <div style={S.note}>⚠ Requires: player (step 1) + seed loaded (step 2)</div>
        ) : null}

        {game.benchmarkFinal !== null && (
          <KV label="Benchmark (buy & hold)" value={`CHF ${game.benchmarkFinal.toFixed(2)}`} />
        )}
        {game.state && (
          <KV
            label="Portfolio"
            value={`CHF ${game.state.totalPortfolio.toFixed(2)}  (tick ${game.state.currentTick}/${game.state.totalTicks})`}
          />
        )}

        <div style={{ ...S.row, marginTop: 10 }}>
          <Btn onClick={handleStartGame} disabled={!canStartGame} variant="primary">
            Start Game
          </Btn>
          <span style={S.hint}>CHF 10,000 · CHF 200/mo · 40% SMI / 20% Bond / 15% Gold / 15% Nestlé / 10% Cash</span>
        </div>

        <div style={{ ...S.row, marginTop: 6 }}>
          <Btn
            onClick={isPlaying ? game.pause : game.play}
            disabled={!hasState || game.phase === "event"}
            variant={isPlaying ? "warning" : "primary"}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </Btn>
          {([1, 3, 5] as const).map((s) => (
            <Btn
              key={s}
              onClick={() => { game.setSpeed(s); setActiveSpeed(s); }}
              disabled={!hasState}
              variant={activeSpeed === s && hasState ? "primary" : undefined}
            >
              {s}x {activeSpeed === s && hasState ? "✓" : ""}
            </Btn>
          ))}
        </div>

        <div style={{ ...S.row, marginTop: 6 }}>
          <Btn onClick={handleRunTenTicks} disabled={!hasState}>
            Run 10 Ticks (auto-pause)
          </Btn>
          <Btn onClick={handleRebalanceTest} disabled={!hasState} variant="warning">
            Test Rebalance → 80% SMI
          </Btn>
        </div>

        {rebalanceResult && (
          <div style={S.success}>
            Rebalance result — before: CHF {rebalanceResult.before.toFixed(2)} · after: CHF{" "}
            {rebalanceResult.after.toFixed(2)}{" "}
            {Math.abs(rebalanceResult.before - rebalanceResult.after) < 0.01
              ? "✅ values identical (correct)"
              : "⚠ values differ (unexpected)"}
          </div>
        )}
      </div>

      {/* ── PORTFOLIO MANAGEMENT ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>💼</span>
          <h2 style={S.h2}>Portfolio Management</h2>
          {hasState && (
            <Badge
              text={`CHF ${game.state!.totalPortfolio.toFixed(0)} total`}
              color="blue"
            />
          )}
        </div>
        <hr style={S.divider} />

        {!hasState ? (
          <div style={S.note}>⚠ Start game first (step 3)</div>
        ) : (
          <>
            {/* Allocation table */}
            <div style={{ fontSize: 11, marginBottom: 10 }}>
              {/* Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 70px 100px 90px",
                gap: 4,
                padding: "4px 6px",
                background: "#f3f4f6",
                borderRadius: "4px 4px 0 0",
                fontWeight: "bold",
                color: "#555",
              }}>
                <span>Asset</span>
                <span style={{ textAlign: "right" }}>Current value</span>
                <span style={{ textAlign: "right" }}>Current %</span>
                <span style={{ textAlign: "center" }}>New %</span>
                <span style={{ textAlign: "right" }}>Projected value</span>
              </div>

              {game.state!.positions.map((pos) => {
                const newPct = allocInputs[pos.assetId] ?? pos.pct;
                const projectedValue = (newPct / 100) * game.state!.totalPortfolio;
                const changed = Math.abs(newPct - pos.pct) > 0.01;
                return (
                  <div
                    key={pos.assetId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 70px 100px 90px",
                      gap: 4,
                      padding: "5px 6px",
                      borderBottom: "1px solid #f0f0f0",
                      alignItems: "center",
                      background: changed ? "#fffbeb" : "transparent",
                    }}
                  >
                    <span>
                      <strong>{pos.assetId}</strong>
                      {assetNameMap[pos.assetId] && (
                        <span style={{ color: "#888", marginLeft: 6 }}>
                          {assetNameMap[pos.assetId]}
                        </span>
                      )}
                    </span>
                    <span style={{ textAlign: "right", color: "#444" }}>
                      CHF {pos.value.toFixed(0)}
                    </span>
                    <span style={{ textAlign: "right", color: "#666" }}>
                      {pos.pct}%
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={allocInputs[pos.assetId] ?? pos.pct}
                        onChange={(e) =>
                          setAllocInputs((prev) => ({
                            ...prev,
                            [pos.assetId]: Number(e.target.value),
                          }))
                        }
                        style={{ width: 56 }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={allocInputs[pos.assetId] ?? pos.pct}
                        onChange={(e) =>
                          setAllocInputs((prev) => ({
                            ...prev,
                            [pos.assetId]: Math.max(0, Math.min(100, Number(e.target.value))),
                          }))
                        }
                        style={{
                          width: 36,
                          fontFamily: "monospace",
                          fontSize: 11,
                          textAlign: "right",
                          border: "1px solid #ccc",
                          borderRadius: 3,
                          padding: "1px 3px",
                        }}
                      />
                      <span style={{ color: "#888" }}>%</span>
                    </div>
                    <span style={{
                      textAlign: "right",
                      color: changed ? (newPct > pos.pct ? "#065f46" : "#991b1b") : "#444",
                      fontWeight: changed ? "bold" : "normal",
                    }}>
                      CHF {projectedValue.toFixed(0)}
                    </span>
                  </div>
                );
              })}

              {/* Total row */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 70px 100px 90px",
                gap: 4,
                padding: "5px 6px",
                background: "#f3f4f6",
                borderRadius: "0 0 4px 4px",
                fontWeight: "bold",
              }}>
                <span>Total</span>
                <span style={{ textAlign: "right" }}>CHF {game.state!.totalPortfolio.toFixed(0)}</span>
                <span style={{ textAlign: "right" }}>100%</span>
                <span style={{
                  textAlign: "center",
                  color: allocOk ? "#065f46" : "#991b1b",
                }}>
                  {allocSum.toFixed(0)}% {!allocOk && "⚠ must = 100"}
                </span>
                <span style={{ textAlign: "right" }}>
                  CHF {game.state!.totalPortfolio.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Allocation bar visualisation */}
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12, background: "#eee" }}>
              {game.state!.positions.map((pos, i) => {
                const pct = allocInputs[pos.assetId] ?? pos.pct;
                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#6b7280"];
                return (
                  <div
                    key={pos.assetId}
                    style={{ width: `${pct}%`, background: colors[i % colors.length], transition: "width 0.2s" }}
                    title={`${pos.assetId}: ${pct}%`}
                  />
                );
              })}
            </div>

            {/* Presets */}
            <div style={{ ...S.row, marginBottom: 10 }}>
              <span style={{ ...S.label, minWidth: "auto" }}>Presets:</span>
              <Btn onClick={() => applyPreset(PRESETS.conservative)}>🛡 Conservative</Btn>
              <Btn onClick={() => applyPreset(PRESETS.balanced)}>⚖ Balanced</Btn>
              <Btn onClick={() => applyPreset(PRESETS.aggressive)}>🚀 Aggressive</Btn>
              <Btn onClick={() => applyPreset(PRESETS.allCash)} variant="warning">💵 All Cash</Btn>
              <Btn onClick={syncAllocsFromState}>↺ Reset</Btn>
            </div>

            {/* Contribution info */}
            <div style={{ ...S.row, marginBottom: 10 }}>
              <span style={S.label}>Monthly contribution</span>
              <span style={S.value}>CHF {game.state!.effectiveContribution.toFixed(0)}</span>
              {game.state!.effectiveContribution !== game.state!.baseContribution && (
                <Badge
                  text={`base: CHF ${game.state!.baseContribution.toFixed(0)} (modified by event)`}
                  color="orange"
                />
              )}
            </div>

            {/* Apply button */}
            <div style={S.row}>
              <Btn
                onClick={handleApplyRebalance}
                disabled={!allocOk}
                variant="primary"
              >
                Apply Rebalance
              </Btn>
              {!allocOk && (
                <span style={{ color: "#991b1b", fontSize: 11 }}>
                  Allocations sum to {allocSum.toFixed(1)}% — must equal 100%
                </span>
              )}
            </div>

            {rebalanceMsg && <div style={S.success}>{rebalanceMsg}</div>}
          </>
        )}
      </div>

      {/* ── STEP 4: Events ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>4️⃣</span>
          <h2 style={S.h2}>Life Events</h2>
          <Badge
            text={hasActiveEvent ? "🔔 event firing!" : "waiting"}
            color={hasActiveEvent ? "orange" : "gray"}
          />
        </div>
        <hr style={S.divider} />

        <div style={S.note}>
          Events fire automatically when the simulation reaches their scheduled tick. Run the game until one triggers.
        </div>

        <div style={S.row}>
          <Btn onClick={handleShowNextEvent} disabled={!hasState}>
            Inspect Next Scheduled Event
          </Btn>
          <span style={S.hint}>
            {game.state?.scheduledEvents?.[0]
              ? `→ fires at tick ${game.state.scheduledEvents[0].tick} (${game.state.scheduledEvents[0].key})`
              : hasState
              ? "no events scheduled"
              : "start game first"}
          </span>
        </div>

        {hasActiveEvent && game.activeEvent && (
          <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 6, padding: 12, marginTop: 8 }}>
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
              {game.activeEvent.icon} {game.activeEvent.title}
            </div>
            <div style={{ color: "#555", marginBottom: 10 }}>{game.activeEvent.description}</div>
            {game.activeEventStats && (
              <div style={S.hint}>
                Social proof: {game.activeEventStats.option_a_count} chose A · {game.activeEventStats.option_b_count} chose B (of {game.activeEventStats.total_choices} total)
              </div>
            )}
            <div style={{ ...S.row, marginTop: 8 }}>
              <Btn onClick={() => handleChooseOption("a")} variant="primary">
                A: {game.activeEvent.optionA.label}
              </Btn>
              <Btn onClick={() => handleChooseOption("b")}>
                B: {game.activeEvent.optionB.label}
              </Btn>
            </div>
            <div style={{ ...S.hint, marginTop: 4 }}>
              A hint: {game.activeEvent.optionA.hint} · B hint: {game.activeEvent.optionB.hint}
            </div>
          </div>
        )}

        {game.historicalNews && (
          <div style={{ ...S.success, marginTop: 8 }}>
            📰 Historical news: {game.historicalNews.name} ({game.historicalNews.type})
          </div>
        )}
      </div>

      {/* ── STEP 5: Live State ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>5️⃣</span>
          <h2 style={S.h2}>Live State + Projection Cone</h2>
          <span style={S.hint}>auto-refreshes every 500ms</span>
        </div>
        <hr style={S.divider} />

        {game.projection && game.state ? (
          <div style={{ marginBottom: 12 }}>
            <ProjectionCone
              projection={game.projection}
              currentPortfolio={game.state.totalPortfolio}
            />
          </div>
        ) : (
          <div style={{ ...S.hint, marginBottom: 10 }}>
            Projection cone appears here once the game is running (calculated every 4 ticks).
          </div>
        )}

        <pre style={S.pre}>{JSON.stringify(liveState, null, 2)}</pre>
      </div>

      {/* ── STEP 6: Skip to End ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>6️⃣</span>
          <h2 style={S.h2}>Completion Test</h2>
          {skipToEndResult && <Badge text="✓ done" color="green" />}
        </div>
        <hr style={S.divider} />

        <div style={S.note}>
          Pauses the engine and runs all remaining ticks synchronously (tests engine in isolation from the timer). Then writes results to Supabase via PUT /api/sessions/:id.
        </div>

        <div style={S.row}>
          <Btn onClick={handleSkipToEnd} disabled={!hasState} variant="danger">
            ⏭ Skip to End
          </Btn>
          {!hasState && <span style={S.hint}>start game first</span>}
        </div>

        {skipToEndResult && (
          <>
            <div style={S.success}>
              Final portfolio: CHF {Number(skipToEndResult.finalPortfolio).toFixed(2)} ·
              Score: {String(skipToEndResult.compositeScore)} ·
              Profile: {String(skipToEndResult.behavioralProfile)} ·
              Ticks run: {String(skipToEndResult.ticksRun)}
            </div>
            <pre style={S.pre}>{JSON.stringify(skipToEndResult, null, 2)}</pre>
          </>
        )}
      </div>

      {/* ── STEP 7: Leaderboard ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: 16 }}>7️⃣</span>
          <h2 style={S.h2}>Leaderboard</h2>
          {entries.length > 0 && <Badge text={`${entries.length} entries`} color="blue" />}
        </div>
        <hr style={S.divider} />

        <div style={S.row}>
          <Btn onClick={handleFetchLeaderboard}>
            {lbLoading ? "Loading…" : "Fetch Leaderboard"}
          </Btn>
          {seedData && <span style={S.hint}>filtering by seed: {seedData.seed.name}</span>}
        </div>

        {entries.length > 0 && (
          <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 10 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                {["#", "Player", "Score", "Final Portfolio", "Profile", "Duration"].map((h) => (
                  <th key={h} style={{ border: "1px solid #e5e7eb", padding: "5px 10px", textAlign: "left", fontWeight: "bold", fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.session_id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ border: "1px solid #e5e7eb", padding: "4px 10px" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "4px 10px" }}>{e.avatar} {e.nickname}</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "4px 10px", fontWeight: "bold" }}>{e.composite_score}</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "4px 10px" }}>CHF {e.final_portfolio.toFixed(0)}</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "4px 10px" }}>{e.behavioral_profile}</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "4px 10px" }}>{e.duration_seconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Output Log ── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <h2 style={S.h2}>Output Log</h2>
          <Btn onClick={() => setOutput({})}>Clear</Btn>
          <span style={S.hint}>all test results accumulated here</span>
        </div>
        <hr style={S.divider} />
        <pre style={{ ...S.pre, maxHeight: 400 }}>{JSON.stringify(output, null, 2)}</pre>
      </div>

      {/* ── AI Coach Popup ── */}
      <CoachPopup
        message={game.coach.currentMessage}
        isLoading={game.coach.isLoading}
        onDismiss={game.coach.dismiss}
      />
    </div>
  );
}

export default function TestPage() {
  return (
    <GameProvider>
      <TestPageContent />
    </GameProvider>
  );
}
