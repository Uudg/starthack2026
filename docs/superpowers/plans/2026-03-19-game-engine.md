# Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a pure TypeScript, client-side game engine for the gamified investment simulation, consisting of 6 focused modules under `src/lib/engine/`.

**Architecture:** Pure functions only — all engine functions are synchronous, stateless, and return new objects (never mutate). React components will later read SimulationState and call engine functions to produce the next state. The engine has no React dependency and no async operations.

**Tech Stack:** TypeScript 5, Next.js 16 (types only), no test framework — verify with `tsc --noEmit` after each task.

---

## File Map

| File | Responsibility | Depends On |
|------|---------------|------------|
| `src/lib/engine/portfolio.ts` | Pure portfolio math: returns, rebalance, contributions, cash moves | `src/lib/types.ts` |
| `src/lib/engine/events.ts` | Life event definitions, scheduler, chain logic, effect application | `src/lib/types.ts`, `portfolio.ts` |
| `src/lib/engine/benchmark.ts` | Pre-compute the "do nothing" benchmark outcome | `src/lib/types.ts`, `portfolio.ts` |
| `src/lib/engine/scoring.ts` | Composite score calculation + behavioral profile detection | `src/lib/types.ts` |
| `src/lib/engine/projection.ts` | Monte Carlo GBM projection cone | `src/lib/types.ts` |
| `src/lib/engine/simulation.ts` | Main engine: init, tick loop, rebalance, event choice dispatch | `src/lib/types.ts`, all above modules |

---

## Task 1: `portfolio.ts` — Pure Portfolio Math

**Files:**
- Create: `src/lib/engine/portfolio.ts`

- [ ] **Step 1: Create the file with all 6 pure functions**

```typescript
// src/lib/engine/portfolio.ts
import type {
  PortfolioPosition,
  ContributionModifier,
} from "@/lib/types";

/** Apply one week of price returns to all non-cash positions. */
export function calculateReturns(
  positions: PortfolioPosition[],
  prices: Record<string, number[]>,
  tick: number,
): PortfolioPosition[] {
  return positions.map((pos) => {
    if (pos.assetId === "cash") return pos;
    const priceNow = prices[pos.assetId]?.[tick];
    const pricePrev = prices[pos.assetId]?.[tick - 1];
    if (!priceNow || !pricePrev || pricePrev === 0) return pos;
    const weeklyReturn = (priceNow - pricePrev) / pricePrev;
    const newValue = pos.value * (1 + weeklyReturn);
    return { ...pos, value: Math.max(newValue, 0) };
  });
}

/** Redistribute totalValue according to new allocation percentages. */
export function rebalancePortfolio(
  totalValue: number,
  newAllocations: Array<{ assetId: string; pct: number }>,
): PortfolioPosition[] {
  return newAllocations.map((a) => ({
    assetId: a.assetId,
    pct: a.pct,
    value: totalValue * (a.pct / 100),
    units: 0,
  }));
}

/** Add monthly contribution proportionally to current allocation. */
export function applyContribution(
  positions: PortfolioPosition[],
  amount: number,
): PortfolioPosition[] {
  const total = positions.reduce((s, p) => s + p.value, 0);
  if (total === 0 || amount === 0) return positions;
  return positions.map((pos) => ({
    ...pos,
    value: pos.value + amount * (pos.value / total),
  }));
}

/** Add or withdraw a lump sum proportionally across all positions. */
export function applyLumpSum(
  positions: PortfolioPosition[],
  amount: number,
): PortfolioPosition[] {
  const total = positions.reduce((s, p) => s + p.value, 0);
  if (total === 0) return positions;
  return positions.map((pos) => ({
    ...pos,
    value: Math.max(0, pos.value + amount * (pos.value / total)),
  }));
}

/** Collapse all positions into cash (panic sell). */
export function moveAllToCash(
  positions: PortfolioPosition[],
): PortfolioPosition[] {
  const total = positions.reduce((s, p) => s + p.value, 0);
  return positions.map((pos) =>
    pos.assetId === "cash"
      ? { ...pos, value: total, pct: 100 }
      : { ...pos, value: 0, pct: 0 },
  );
}

/** Base contribution adjusted by all active modifiers. */
export function getEffectiveContribution(
  base: number,
  modifiers: ContributionModifier[],
  currentTick: number,
): number {
  const active = modifiers.filter(
    (m) => m.expiresAtTick === null || currentTick < m.expiresAtTick,
  );
  const delta = active.reduce((s, m) => s + m.amount, 0);
  return Math.max(0, base + delta);
}

/** Sum all position values. */
export function getTotalPortfolio(positions: PortfolioPosition[]): number {
  return positions.reduce((s, p) => s + p.value, 0);
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack/app
git add src/lib/engine/portfolio.ts
git commit -m "feat: add portfolio pure-math utilities"
```

---

## Task 2: `events.ts` — Life Event Definitions + Scheduling

**Files:**
- Create: `src/lib/engine/events.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/engine/events.ts
import type {
  LifeEventDefinition,
  ScheduledEvent,
  ChainState,
  SimulationState,
  ContributionModifier,
} from "@/lib/types";
import type { Seed } from "@/lib/types";
import {
  applyLumpSum,
  moveAllToCash,
} from "@/lib/engine/portfolio";

// ── Event Definitions ──────────────────────────────────────────────────────

export const LIFE_EVENTS: Record<string, LifeEventDefinition> = {
  "career.opportunity": {
    key: "career.opportunity",
    chain: "career",
    title: "Career Opportunity",
    icon: "💼",
    description:
      "A competitor offers you a 30% salary increase, but you need CHF 5,000 for relocation costs.",
    optionA: {
      label: "Take the new job",
      hint: "Portfolio −CHF 5,000, contributions +CHF 150/mo permanently",
      effect: {
        portfolioChange: -5000,
        contributionChange: 150,
        contributionDuration: null,
        description: "Sold CHF 5,000 for relocation. Salary increased.",
      },
    },
    optionB: {
      label: "Stay at current job",
      hint: "No change",
      effect: {
        description: "Stayed put. No financial impact.",
      },
    },
  },

  "career.promotion": {
    key: "career.promotion",
    chain: "career",
    title: "Promotion Offer",
    icon: "📈",
    description:
      "You're offered a leadership role. Higher salary, but professional development costs CHF 3,000.",
    optionA: {
      label: "Accept the promotion",
      hint: "Portfolio −CHF 3,000, contributions +CHF 100/mo permanently",
      effect: {
        portfolioChange: -3000,
        contributionChange: 100,
        contributionDuration: null,
        description: "Invested in career growth. Higher salary ahead.",
      },
    },
    optionB: {
      label: "Decline, stay as individual contributor",
      hint: "No change",
      effect: {
        description: "Kept current role. Stable but no salary increase.",
      },
    },
  },

  "career.stagnation": {
    key: "career.stagnation",
    chain: "career",
    title: "Company Downsizing",
    icon: "📉",
    description:
      "Your company is restructuring. You're offered a severance package or reduced hours.",
    optionA: {
      label: "Take severance (CHF 8,000)",
      hint: "Portfolio +CHF 8,000, contributions −CHF 200/mo for ~1 year",
      effect: {
        portfolioChange: 8000,
        contributionChange: -200,
        contributionDuration: 50,
        description: "Took severance. Job hunting for a year.",
      },
    },
    optionB: {
      label: "Accept reduced hours",
      hint: "Contributions −CHF 100/mo permanently",
      effect: {
        contributionChange: -100,
        contributionDuration: null,
        description: "Reduced salary permanently.",
      },
    },
  },

  "personal.housing": {
    key: "personal.housing",
    chain: "personal",
    title: "Property Opportunity",
    icon: "🏠",
    description:
      "You can buy your first apartment. Down payment is CHF 15,000. Rent is rising fast otherwise.",
    optionA: {
      label: "Buy — use CHF 15,000 from portfolio",
      hint: "Portfolio −CHF 15,000",
      effect: {
        portfolioChange: -15000,
        description: "Bought property. Large withdrawal from portfolio.",
      },
    },
    optionB: {
      label: "Keep renting",
      hint: "Contributions −CHF 100/mo permanently (rising rent)",
      effect: {
        contributionChange: -100,
        contributionDuration: null,
        description: "Rent keeps rising. Less to invest each month.",
      },
    },
  },

  "personal.health": {
    key: "personal.health",
    chain: "personal",
    title: "Medical Emergency",
    icon: "🏥",
    description:
      "An unexpected surgery. Insurance covers most of it, but you owe CHF 6,000 out of pocket.",
    optionA: {
      label: "Sell investments to pay",
      hint: "Portfolio −CHF 6,000",
      effect: {
        portfolioChange: -6000,
        description: "Paid medical bill from portfolio.",
      },
    },
    optionB: {
      label: "Payment plan",
      hint: "Contributions −CHF 250/mo for ~6 months",
      effect: {
        contributionChange: -250,
        contributionDuration: 24,
        description: "Monthly payments for 6 months.",
      },
    },
  },

  "personal.renovation": {
    key: "personal.renovation",
    chain: "personal",
    title: "Home Repair Crisis",
    icon: "🔧",
    description:
      "Your roof needs urgent replacing. The bill is CHF 8,000. This is the reality of property ownership.",
    optionA: {
      label: "Sell from portfolio",
      hint: "Portfolio −CHF 8,000",
      effect: {
        portfolioChange: -8000,
        description: "Another withdrawal. Property costs add up.",
      },
    },
    optionB: {
      label: "Take a renovation loan",
      hint: "Contributions −CHF 150/mo for ~10 months",
      effect: {
        contributionChange: -150,
        contributionDuration: 40,
        description: "Loan payments for 10 months.",
      },
    },
  },

  "crisis.crash_news": {
    key: "crisis.crash_news",
    chain: "crisis",
    title: "Markets in Freefall",
    icon: "📰",
    description:
      "Breaking news: markets have crashed. Headlines predict worse ahead. Social media is full of panic. Your portfolio is bleeding.",
    optionA: {
      label: "Sell everything — move to cash",
      hint: "All positions converted to cash immediately",
      effect: {
        moveAllToCash: true,
        description: "Panic sold. Moved everything to cash.",
      },
    },
    optionB: {
      label: "Stay the course — ignore the noise",
      hint: "No change to portfolio",
      effect: {
        description: "Held steady through the storm.",
      },
    },
  },

  "crisis.windfall": {
    key: "crisis.windfall",
    chain: "crisis",
    title: "Unexpected Inheritance",
    icon: "💰",
    description: "A relative has left you CHF 10,000. A bittersweet surprise.",
    optionA: {
      label: "Invest it all",
      hint: "Portfolio +CHF 10,000 at current allocation",
      effect: {
        portfolioChange: 10000,
        description: "Added full inheritance to portfolio.",
      },
    },
    optionB: {
      label: "Invest CHF 5,000, keep CHF 5,000 as cash",
      hint: "Portfolio +CHF 5,000, Cash +CHF 5,000",
      effect: {
        portfolioChange: 5000,
        description: "Split inheritance. Half invested, half in cash.",
      },
    },
  },
};

// ── Scheduler ──────────────────────────────────────────────────────────────

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function scheduleInitialEvents(
  seed: Seed,
  totalTicks: number,
): { events: ScheduledEvent[]; chainState: ChainState } {
  const crashTick =
    seed.crash_weeks && seed.crash_weeks[0] !== undefined &&
    seed.crash_weeks[0] <= totalTicks - 30
      ? seed.crash_weeks[0]
      : randBetween(200, 350);

  const windfall = Math.min(
    randBetween(350, 450),
    totalTicks - 30,
  );

  const raw: ScheduledEvent[] = [
    { chain: "career", key: "career.opportunity", tick: randBetween(40, 80) },
    { chain: "personal", key: "personal.housing", tick: randBetween(100, 180) },
    { chain: "personal", key: "personal.health", tick: randBetween(250, 350) },
    { chain: "crisis", key: "crisis.crash_news", tick: crashTick },
    { chain: "crisis", key: "crisis.windfall", tick: Math.max(windfall, crashTick + 30) },
  ];

  // Sort by tick
  raw.sort((a, b) => a.tick - b.tick);

  // Resolve conflicts: no two events within 15 ticks
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].tick - raw[i - 1].tick < 15) {
      raw[i].tick = raw[i - 1].tick + 20;
    }
  }

  // Push back any events in last 30 ticks
  for (const ev of raw) {
    if (ev.tick > totalTicks - 30) {
      ev.tick = totalTicks - 30;
    }
  }

  const chainState: ChainState = {
    career: { active: true, tookNewJob: false, promoted: false, stagnated: false },
    personal: { active: true, boughtProperty: false, hadHealthScare: false },
    crisis: { panicSold: false, receivedWindfall: false },
  };

  return { events: raw, chainState };
}

export function scheduleFollowUpEvent(
  eventKey: string,
  chosen: "a" | "b",
  currentTick: number,
  totalTicks: number,
): ScheduledEvent | null {
  let followUp: { key: string; chain: ScheduledEvent["chain"]; offset: [number, number] } | null = null;

  if (eventKey === "career.opportunity" && chosen === "a") {
    followUp = { key: "career.promotion", chain: "career", offset: [100, 170] };
  } else if (eventKey === "career.opportunity" && chosen === "b") {
    followUp = { key: "career.stagnation", chain: "career", offset: [120, 200] };
  } else if (eventKey === "personal.housing" && chosen === "a") {
    followUp = { key: "personal.renovation", chain: "personal", offset: [150, 250] };
  }

  if (!followUp) return null;

  const tick = Math.min(
    currentTick + randBetween(followUp.offset[0], followUp.offset[1]),
    totalTicks - 30,
  );

  return { chain: followUp.chain, key: followUp.key, tick };
}

// ── Effect Application ─────────────────────────────────────────────────────

export function applyEventEffect(
  state: SimulationState,
  eventKey: string,
  chosen: "a" | "b",
): SimulationState {
  const def = LIFE_EVENTS[eventKey];
  if (!def) return state;

  const effect = chosen === "a" ? def.optionA.effect : def.optionB.effect;
  let positions = [...state.positions];
  let contributionModifiers = [...state.contributionModifiers];
  let chainState: ChainState = {
    career: { ...state.chainState.career },
    personal: { ...state.chainState.personal },
    crisis: { ...state.chainState.crisis },
  };

  // Apply portfolio changes
  if (effect.moveAllToCash) {
    positions = moveAllToCash(positions);
  } else if (effect.portfolioChange !== undefined) {
    // Special case: crisis.windfall option B — add 5k to portfolio + 5k directly to cash
    if (eventKey === "crisis.windfall" && chosen === "b") {
      positions = applyLumpSum(positions, 5000);
      positions = positions.map((pos) =>
        pos.assetId === "cash"
          ? { ...pos, value: pos.value + 5000 }
          : pos,
      );
    } else {
      positions = applyLumpSum(positions, effect.portfolioChange);
    }
  }

  // Apply contribution modifier
  if (effect.contributionChange !== undefined) {
    const expiresAtTick =
      effect.contributionDuration !== null && effect.contributionDuration !== undefined
        ? state.currentTick + effect.contributionDuration
        : null;
    contributionModifiers = [
      ...contributionModifiers,
      {
        reason: def.title,
        amount: effect.contributionChange,
        expiresAtTick,
      },
    ];
  }

  // Update chain state flags
  if (eventKey === "career.opportunity" && chosen === "a") {
    chainState.career.tookNewJob = true;
  } else if (eventKey === "career.promotion" && chosen === "a") {
    chainState.career.promoted = true;
  } else if (eventKey === "career.stagnation") {
    chainState.career.stagnated = true;
  } else if (eventKey === "personal.housing" && chosen === "a") {
    chainState.personal.boughtProperty = true;
  } else if (eventKey === "personal.health") {
    chainState.personal.hadHealthScare = true;
  } else if (eventKey === "crisis.crash_news" && chosen === "a") {
    chainState.crisis.panicSold = true;
  } else if (eventKey === "crisis.windfall") {
    chainState.crisis.receivedWindfall = true;
  }

  return {
    ...state,
    positions,
    contributionModifiers,
    chainState,
    totalPortfolio: positions.reduce((s, p) => s + p.value, 0),
  };
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack/app
git add src/lib/engine/events.ts
git commit -m "feat: add life event definitions, scheduler, and effect application"
```

---

## Task 3: `benchmark.ts` — Do-Nothing Benchmark

**Files:**
- Create: `src/lib/engine/benchmark.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/engine/benchmark.ts
import { calculateReturns, applyContribution, getTotalPortfolio } from "@/lib/engine/portfolio";
import type { PortfolioPosition } from "@/lib/types";

interface BenchmarkConfig {
  prices: Record<string, number[]>;
  startingPortfolio: number;
  monthlyContribution: number;
  totalTicks: number;
  allocations?: Array<{ assetId: string; pct: number }>;
}

/**
 * Simulate the "do nothing" outcome: player's initial allocation,
 * base contributions only, no rebalances, no life event effects.
 * Returns the final total portfolio value.
 */
export function calculateBenchmark(config: BenchmarkConfig): number {
  const { prices, startingPortfolio, monthlyContribution, totalTicks, allocations } = config;

  // Default to equal-weight among available assets (exclude cash)
  const assetIds = Object.keys(prices).filter((id) => id !== "cash");
  const allocs: Array<{ assetId: string; pct: number }> =
    allocations ??
    assetIds.map((id) => ({ assetId: id, pct: 100 / assetIds.length }));

  let positions: PortfolioPosition[] = allocs.map((a) => ({
    assetId: a.assetId,
    pct: a.pct,
    value: startingPortfolio * (a.pct / 100),
    units: 0,
  }));

  for (let tick = 1; tick <= totalTicks; tick++) {
    positions = calculateReturns(positions, prices, tick);
    if (tick % 4 === 0) {
      positions = applyContribution(positions, monthlyContribution);
    }
  }

  return getTotalPortfolio(positions);
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack/app
git add src/lib/engine/benchmark.ts
git commit -m "feat: add benchmark calculator (do-nothing baseline)"
```

---

## Task 4: `scoring.ts` — Score + Behavioral Profile

**Files:**
- Create: `src/lib/engine/scoring.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/engine/scoring.ts
import type { BehavioralProfile, ChainState, TriggeredEvent } from "@/lib/types";

interface ScoringInput {
  finalPortfolio: number;
  startingPortfolio: number;
  totalContributed: number;
  benchmarkFinal: number;
  totalRebalances: number;
  panicRebalances: number;
  cashHeavyWeeks: number;
  totalWeeks: number;
  maxDrawdownPct: number;
  chainState: ChainState;
  triggeredEvents: TriggeredEvent[];
}

export function calculateCompositeScore(input: ScoringInput): number {
  const {
    finalPortfolio,
    benchmarkFinal,
    totalRebalances,
    panicRebalances,
    cashHeavyWeeks,
    totalWeeks,
    triggeredEvents,
  } = input;

  // Portfolio score (0–100)
  const ratio = benchmarkFinal > 0 ? finalPortfolio / benchmarkFinal : 0;
  const portfolioScore = Math.min(ratio * 80, 100);

  // Discipline score (0–100)
  let disciplineScore = 100;
  disciplineScore -= panicRebalances * 15;
  disciplineScore -= (cashHeavyWeeks / totalWeeks) * 30;
  disciplineScore -= Math.max(0, totalRebalances - 5) * 3;
  disciplineScore = Math.max(0, disciplineScore);

  // Event score (0–100)
  let eventRaw = 0;
  const maxPossible = triggeredEvents.length > 0 ? triggeredEvents.length * 25 : 1;

  for (const ev of triggeredEvents) {
    if (ev.key === "crisis.crash_news") {
      eventRaw += ev.chosen === "b" ? 25 : 0;
    } else if (ev.key === "career.opportunity" && ev.chosen === "a") {
      eventRaw += 15;
    } else if (ev.key === "crisis.windfall" && ev.chosen === "a") {
      eventRaw += 10;
    } else {
      eventRaw += 5;
    }
  }

  const eventScore = triggeredEvents.length === 0
    ? 50
    : Math.min((eventRaw / maxPossible) * 100, 100);

  const composite =
    portfolioScore * 0.4 + disciplineScore * 0.35 + eventScore * 0.25;

  return Math.round(composite * 10) / 10;
}

export function detectBehavioralProfile(input: ScoringInput): BehavioralProfile {
  const {
    panicRebalances,
    chainState,
    cashHeavyWeeks,
    totalWeeks,
    totalRebalances,
    finalPortfolio,
    benchmarkFinal,
  } = input;

  if (panicRebalances >= 1 && chainState.crisis.panicSold) {
    return "panic_seller";
  }
  if (cashHeavyWeeks >= totalWeeks * 0.3) {
    return "cash_hoarder";
  }
  if (totalRebalances >= 8) {
    return "overthinker";
  }
  if (finalPortfolio > benchmarkFinal && panicRebalances === 0) {
    return "strategist";
  }
  if (totalRebalances <= 2 && cashHeavyWeeks < totalWeeks * 0.1) {
    return "diamond_hands";
  }
  return "momentum_chaser";
}

export function getProfileDisplay(
  profile: BehavioralProfile,
  input?: Partial<ScoringInput>,
): {
  name: string;
  icon: string;
  description: string;
} {
  const cashWeeks = input?.cashHeavyWeeks ?? 0;
  const benchmarkDiff =
    input?.finalPortfolio !== undefined && input?.benchmarkFinal !== undefined
      ? Math.round(input.finalPortfolio - input.benchmarkFinal)
      : 0;
  const rebalances = input?.totalRebalances ?? 0;

  const map: Record<BehavioralProfile, { name: string; icon: string; description: string }> = {
    panic_seller: {
      name: "The Panic Seller",
      icon: "🔴",
      description:
        "Fear drove your biggest decisions. You sold during the crash and shifted to safety during drawdowns.",
    },
    cash_hoarder: {
      name: "The Cash Hoarder",
      icon: "🏦",
      description: `You kept a huge cash position for ${cashWeeks} weeks. Cash feels safe, but inflation eats it alive.`,
    },
    overthinker: {
      name: "The Overthinker",
      icon: "🔄",
      description: `You made ${rebalances} changes. Every move felt logical, but the friction cost you.`,
    },
    strategist: {
      name: "The Strategist",
      icon: "🎯",
      description: `You beat the benchmark by CHF ${Math.abs(benchmarkDiff).toLocaleString()}. Rare skill — or lucky timing?`,
    },
    diamond_hands: {
      name: "Diamond Hands",
      icon: "💎",
      description:
        "You barely touched your portfolio through crashes, panics, and headlines. Boring? Yes. Effective? Absolutely.",
    },
    momentum_chaser: {
      name: "The Active Investor",
      icon: "📊",
      description:
        "You stayed engaged and made adjustments along the way.",
    },
  };

  return map[profile];
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack/app
git add src/lib/engine/scoring.ts
git commit -m "feat: add composite score calculator and behavioral profile detector"
```

---

## Task 5: `projection.ts` — Monte Carlo Cone

**Files:**
- Create: `src/lib/engine/projection.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/engine/projection.ts
import type { PortfolioPosition } from "@/lib/types";

interface ProjectionConfig {
  currentPortfolio: number;
  positions: PortfolioPosition[];
  monthlyContribution: number;
  remainingTicks: number;
  prices: Record<string, number[]>;
  currentTick: number;
  numPaths?: number;
}

interface ProjectionResult {
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  medianFinal: number;
  targetProbability: number;
}

function randomNormal(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function calculateProjection(config: ProjectionConfig): ProjectionResult {
  const {
    currentPortfolio,
    positions,
    monthlyContribution,
    remainingTicks,
    prices,
    currentTick,
    numPaths = 200,
  } = config;

  // 1. Compute blended mu and sigma from recent price history
  let muPortfolio = 0;
  let sigmaPortfolio = 0;
  const totalValue = positions.reduce((s, p) => s + p.value, 0);

  for (const pos of positions) {
    if (pos.assetId === "cash" || !prices[pos.assetId]) continue;
    const priceArr = prices[pos.assetId];
    const start = Math.max(0, currentTick - 52);
    const end = currentTick;
    const logReturns: number[] = [];
    for (let t = start + 1; t <= end; t++) {
      const prev = priceArr[t - 1];
      const curr = priceArr[t];
      if (prev && curr && prev > 0) {
        logReturns.push(Math.log(curr / prev));
      }
    }
    if (logReturns.length === 0) continue;
    const meanWeekly = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance =
      logReturns.reduce((s, r) => s + (r - meanWeekly) ** 2, 0) / logReturns.length;
    const sigmaWeeklyAnnualized = Math.sqrt(variance * 52);
    const muAnnualized = meanWeekly * 52;

    const weight = totalValue > 0 ? pos.value / totalValue : 0;
    muPortfolio += weight * muAnnualized;
    sigmaPortfolio += weight * sigmaWeeklyAnnualized;
  }

  // Fallback if no price history
  if (sigmaPortfolio === 0) {
    sigmaPortfolio = 0.15;
    muPortfolio = 0.06;
  }

  const weeklyMu = muPortfolio / 52;
  const weeklySigma = sigmaPortfolio / Math.sqrt(52);

  // 2. Run GBM paths, store every 4th tick
  const storedPoints = Math.ceil(remainingTicks / 4);
  const allPathValues: Float64Array[] = Array.from(
    { length: storedPoints },
    () => new Float64Array(numPaths),
  );

  const target =
    currentPortfolio + monthlyContribution * (remainingTicks / 4);

  let pathsAboveTarget = 0;

  for (let p = 0; p < numPaths; p++) {
    let value = currentPortfolio;
    let storeIdx = 0;
    for (let t = 1; t <= remainingTicks; t++) {
      const z = randomNormal();
      value =
        value * Math.exp(weeklyMu - 0.5 * weeklySigma ** 2 + weeklySigma * z);
      if (t % 4 === 0) {
        value += monthlyContribution;
      }
      if (t % 4 === 0 && storeIdx < storedPoints) {
        allPathValues[storeIdx][p] = value;
        storeIdx++;
      }
    }
    if (value > target) pathsAboveTarget++;
  }

  // 3. Compute percentiles at each stored point
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];

  for (let i = 0; i < storedPoints; i++) {
    const sorted = Array.from(allPathValues[i]).sort((a, b) => a - b);
    p5.push(percentile(sorted, 5));
    p25.push(percentile(sorted, 25));
    p50.push(percentile(sorted, 50));
    p75.push(percentile(sorted, 75));
    p95.push(percentile(sorted, 95));
  }

  return {
    percentiles: { p5, p25, p50, p75, p95 },
    medianFinal: p50[p50.length - 1] ?? currentPortfolio,
    targetProbability: Math.round((pathsAboveTarget / numPaths) * 100),
  };
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack/app
git add src/lib/engine/projection.ts
git commit -m "feat: add Monte Carlo projection cone (GBM, 200 paths)"
```

---

## Task 6: `simulation.ts` — Main Engine

**Files:**
- Create: `src/lib/engine/simulation.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/engine/simulation.ts
import type {
  SimulationState,
  PortfolioPosition,
  LifeEventDefinition,
  HistoricalEvent,
} from "@/lib/types";
import type { Seed } from "@/lib/types";
import {
  calculateReturns,
  rebalancePortfolio,
  applyContribution,
  getTotalPortfolio,
  getEffectiveContribution,
} from "@/lib/engine/portfolio";
import {
  scheduleInitialEvents,
  scheduleFollowUpEvent,
  applyEventEffect,
  LIFE_EVENTS,
} from "@/lib/engine/events";

// ── Types ──────────────────────────────────────────────────────────────────

interface SimConfig {
  seed: Seed;
  assets: import("@/lib/types").Asset[];
  prices: Record<string, number[]>;
  startingPortfolio: number;
  monthlyContribution: number;
  allocations: Array<{ assetId: string; pct: number }>;
}

interface TickResult {
  state: SimulationState;
  eventToFire: LifeEventDefinition | null;
  historicalNews: HistoricalEvent | null;
  isComplete: boolean;
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initSimulation(config: SimConfig): SimulationState {
  const { seed, prices, startingPortfolio, monthlyContribution, allocations } = config;
  const totalTicks = seed.total_weeks ?? seed.end_week - seed.start_week;

  const positions: PortfolioPosition[] = allocations.map((a) => ({
    assetId: a.assetId,
    pct: a.pct,
    value: startingPortfolio * (a.pct / 100),
    units: 0,
  }));

  const { events, chainState } = scheduleInitialEvents(seed, totalTicks);

  return {
    currentTick: 0,
    totalTicks,
    isPlaying: false,
    speed: 1,

    positions,
    cashValue: positions.find((p) => p.assetId === "cash")?.value ?? 0,
    totalPortfolio: startingPortfolio,

    baseContribution: monthlyContribution,
    contributionModifiers: [],
    effectiveContribution: monthlyContribution,

    peakPortfolio: startingPortfolio,
    currentDrawdownPct: 0,
    totalRebalances: 0,
    panicRebalances: 0,
    cashHeavyWeeks: 0,
    maxDrawdownPct: 0,

    chainState,
    scheduledEvents: events,
    triggeredEvents: [],
    activeEvent: null,

    prices,
  };
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function tickSimulation(state: SimulationState, seed: Seed): TickResult {
  const currentTick = state.currentTick + 1;

  // 1. Apply returns
  let positions = calculateReturns(state.positions, state.prices, currentTick);

  // 2. Monthly contribution (every 4th tick)
  const effectiveContribution = getEffectiveContribution(
    state.baseContribution,
    state.contributionModifiers,
    currentTick,
  );
  if (currentTick % 4 === 0) {
    positions = applyContribution(positions, effectiveContribution);
  }

  // 3. Recalculate totals
  const totalPortfolio = getTotalPortfolio(positions);
  const cashPos = positions.find((p) => p.assetId === "cash");
  const cashValue = cashPos?.value ?? 0;

  // 4. Analytics
  const peakPortfolio = Math.max(state.peakPortfolio, totalPortfolio);
  const currentDrawdownPct =
    peakPortfolio > 0
      ? ((peakPortfolio - totalPortfolio) / peakPortfolio) * 100
      : 0;
  const maxDrawdownPct = Math.max(state.maxDrawdownPct, currentDrawdownPct);
  const cashHeavyWeeks =
    state.cashHeavyWeeks + (cashValue > totalPortfolio * 0.5 ? 1 : 0);

  // 5. Expire contribution modifiers
  const contributionModifiers = state.contributionModifiers.filter(
    (m) => m.expiresAtTick === null || currentTick < m.expiresAtTick,
  );

  // 6. Check for scheduled event at this tick
  const firedEvent = state.scheduledEvents.find((e) => e.tick === currentTick);
  const eventToFire = firedEvent ? (LIFE_EVENTS[firedEvent.key] ?? null) : null;

  // 7. Check for historical news flash
  const historicalNews =
    seed.historical_events?.find((e) => e.week === currentTick) ?? null;

  // 8. Completion check
  const isComplete = currentTick >= state.totalTicks;

  const nextState: SimulationState = {
    ...state,
    currentTick,
    positions,
    cashValue,
    totalPortfolio,
    effectiveContribution,
    contributionModifiers,
    peakPortfolio,
    currentDrawdownPct,
    maxDrawdownPct,
    cashHeavyWeeks,
  };

  return { state: nextState, eventToFire, historicalNews, isComplete };
}

// ── Rebalance ──────────────────────────────────────────────────────────────

export function handleRebalance(
  state: SimulationState,
  newAllocations: Array<{ assetId: string; pct: number }>,
): SimulationState {
  const totalValue = getTotalPortfolio(state.positions);
  const newPositions = rebalancePortfolio(totalValue, newAllocations);

  // Detect panic rebalance: drawdown > 15% AND cash+bonds allocation increased by > 20pp
  const safeAssets = new Set(["cash", "ch_bond", "bond", "bonds"]);
  const prevSafePct = state.positions
    .filter((p) => safeAssets.has(p.assetId))
    .reduce((s, p) => s + p.pct, 0);
  const newSafePct = newAllocations
    .filter((a) => safeAssets.has(a.assetId))
    .reduce((s, a) => s + a.pct, 0);
  const isPanic =
    state.currentDrawdownPct > 15 && newSafePct - prevSafePct > 20;

  return {
    ...state,
    positions: newPositions,
    totalPortfolio: getTotalPortfolio(newPositions),
    cashValue: newPositions.find((p) => p.assetId === "cash")?.value ?? 0,
    totalRebalances: state.totalRebalances + 1,
    panicRebalances: state.panicRebalances + (isPanic ? 1 : 0),
  };
}

// ── Event Choice ───────────────────────────────────────────────────────────

export function handleEventChoice(
  state: SimulationState,
  eventKey: string,
  chosen: "a" | "b",
  totalTicks: number,
): SimulationState {
  const portfolioBefore = state.totalPortfolio;

  // Apply effect
  let next = applyEventEffect(state, eventKey, chosen);
  const portfolioAfter = getTotalPortfolio(next.positions);

  // Record triggered event
  const def = LIFE_EVENTS[eventKey];
  next = {
    ...next,
    triggeredEvents: [
      ...next.triggeredEvents,
      {
        key: eventKey,
        chain: def?.chain ?? "",
        chosen,
        tick: state.currentTick,
        portfolioBefore,
        portfolioAfter,
      },
    ],
  };

  // Schedule follow-up if applicable
  const followUp = scheduleFollowUpEvent(eventKey, chosen, state.currentTick, totalTicks);
  if (followUp) {
    const updatedScheduled = [...next.scheduledEvents, followUp].sort(
      (a, b) => a.tick - b.tick,
    );
    next = { ...next, scheduledEvents: updatedScheduled };
  }

  // Clear active event
  next = { ...next, activeEvent: null };

  return next;
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack/app
git add src/lib/engine/simulation.ts
git commit -m "feat: add main simulation engine (init, tick, rebalance, event choice)"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Full type-check**

```bash
cd /Users/apple/Documents/starthack/app && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 2: Verify all 6 files exist**

```bash
ls /Users/apple/Documents/starthack/app/src/lib/engine/
```
Expected output:
```
benchmark.ts  events.ts  portfolio.ts  projection.ts  scoring.ts  simulation.ts
```

- [ ] **Step 3: Final commit**

```bash
cd /Users/apple/Documents/starthack/app
git add -A
git commit -m "feat: complete game engine (portfolio, events, benchmark, scoring, projection, simulation)"
```
