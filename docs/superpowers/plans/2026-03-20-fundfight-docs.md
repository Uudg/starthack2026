# FundFight Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a Fumadocs documentation site into the existing FundFight Next.js app, accessible at `/docs`, explaining backend systems for PostFinance judges.

**Architecture:** Fumadocs MDX is added as a Next.js plugin; content lives in `app/content/docs/` as MDX files; the `/docs/[[...slug]]` route renders them with Fumadocs UI. No separate app — everything is in the existing `app/` workspace.

**Tech Stack:** Next.js 16.2, React 19, Fumadocs 15.x (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`), Tailwind CSS 4, TypeScript, MDX.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `app/next.config.ts` | Wrap config with `createMDX()` plugin |
| Create | `app/source.config.ts` | Fumadocs MDX collection definition |
| Create | `app/src/lib/source.ts` | Fumadocs source loader (next to engine/, hooks/) |
| Create | `app/src/app/docs/layout.tsx` | DocsLayout with sidebar nav |
| Create | `app/src/app/docs/[[...slug]]/page.tsx` | Dynamic MDX page renderer |
| Create | `app/content/docs/meta.json` | Sidebar order and labels |
| Create | `app/content/docs/index.mdx` | Overview page |
| Create | `app/content/docs/market-data.mdx` | Market Data & Scenarios |
| Create | `app/content/docs/simulation-engine.mdx` | The Simulation Engine |
| Create | `app/content/docs/portfolio-management.mdx` | Portfolio Management |
| Create | `app/content/docs/life-events.mdx` | Life Event System |
| Create | `app/content/docs/monte-carlo.mdx` | Monte Carlo Projections |
| Create | `app/content/docs/scoring.mdx` | Scoring & Behavioral Profiles |
| Create | `app/content/docs/ai-coach.mdx` | AI Coach |
| Create | `app/content/docs/api-reference.mdx` | API Reference |

---

## Task 1: Install Fumadocs Dependencies

**Files:**
- Modify: `app/package.json` (via yarn)

- [ ] **Step 1: Install packages**

```bash
cd /Users/apple/Documents/starthack/app
yarn add fumadocs-core fumadocs-ui fumadocs-mdx rehype-pretty-code shiki
```

- [ ] **Step 2: Verify installation — check no peer dep errors**

```bash
cd /Users/apple/Documents/starthack/app
yarn why fumadocs-core
```

Expected: resolves without errors. If React peer dep conflict, run:
```bash
yarn add fumadocs-core fumadocs-ui fumadocs-mdx --ignore-peer
```

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/package.json yarn.lock
git commit -m "feat: install fumadocs dependencies"
```

Note: this monorepo has a single lockfile at the root (`yarn.lock`), not inside `app/`.

---

## Task 2: Configure Fumadocs MDX Plugin in next.config.ts

**Files:**
- Modify: `app/next.config.ts`

- [ ] **Step 1: Read current next.config.ts to confirm it is minimal**

Current content:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

- [ ] **Step 2: Update next.config.ts**

Replace the entire file with:

```ts
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  /* config options here */
};

const withMDX = createMDX();

export default withMDX(nextConfig);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/next.config.ts
git commit -m "feat: wrap next config with fumadocs-mdx plugin"
```

---

## Task 3: Create source.config.ts

**Files:**
- Create: `app/source.config.ts`

- [ ] **Step 1: Create the file**

```ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig({});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/source.config.ts
git commit -m "feat: add fumadocs source config"
```

---

## Task 4: Create src/lib/source.ts

**Files:**
- Create: `app/src/lib/source.ts`

- [ ] **Step 1: Create the file**

```ts
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";
import { docs } from "../../source.config";

export const source = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs),
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/src/lib/source.ts
git commit -m "feat: add fumadocs source loader"
```

---

## Task 5: Create Docs Layout

**Files:**
- Create: `app/src/app/docs/layout.tsx`

- [ ] **Step 1: Create the layout file**

```tsx
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import "fumadocs-ui/style.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: "FundFight Docs",
      }}
    >
      {children}
    </DocsLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/src/app/docs/layout.tsx
git commit -m "feat: add fumadocs docs layout"
```

---

## Task 6: Create Dynamic Page Route

**Files:**
- Create: `app/src/app/docs/[[...slug]]/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/src/app/docs/[[...slug]]/page.tsx
git commit -m "feat: add fumadocs dynamic page route"
```

---

## Task 7: Smoke Test — Verify Dev Server Starts

- [ ] **Step 1: Start dev server and check /docs loads**

```bash
cd /Users/apple/Documents/starthack/app
yarn dev
```

Visit `http://localhost:3000/docs` — should render the Fumadocs shell (sidebar + empty content area, or 404 since no content yet is fine).

**If you see a module-not-found error for `fumadocs-ui/style.css`:**
Check the actual export path:
```bash
cat node_modules/fumadocs-ui/package.json | grep -A2 '"style"'
```
Adjust the import in `docs/layout.tsx` to match the real path (e.g. `fumadocs-ui/styles.css`).

**If styles are broken (unstyled HTML) with Tailwind CSS 4:**
Fumadocs 15.x ships its own CSS. If Tailwind 4 isn't picking it up, add an `@source` directive to `app/src/app/globals.css`:
```css
@source "../../../node_modules/fumadocs-ui/dist";
```
This tells Tailwind 4 to scan Fumadocs UI's dist for class names.

- [ ] **Step 2: Stop dev server once confirmed working (Ctrl+C)**

- [ ] **Step 3: Commit (only if any fix was needed)**

```bash
cd /Users/apple/Documents/starthack
git add -A
git commit -m "fix: correct fumadocs css import path"
```

---

## Task 8: Create Content Structure and meta.json

**Files:**
- Create: `app/content/docs/meta.json`

- [ ] **Step 1: Create content directory and meta.json**

```bash
mkdir -p /Users/apple/Documents/starthack/app/content/docs
```

Create `app/content/docs/meta.json`:

```json
{
  "title": "FundFight Docs",
  "pages": [
    "index",
    "market-data",
    "simulation-engine",
    "portfolio-management",
    "life-events",
    "monte-carlo",
    "scoring",
    "ai-coach",
    "api-reference"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/meta.json
git commit -m "feat: add docs content structure"
```

---

## Task 9: Write index.mdx — Overview

**Files:**
- Create: `app/content/docs/index.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: Overview
description: What FundFight is, why it was built, and how the system is structured.
---

## What is FundFight?

FundFight is a gamified investment education platform built for PostFinance. It lets beginners experience 10 years of real financial markets in minutes — making portfolio decisions, navigating life events, and learning the principles of long-term investing without risking real money.

The core challenge it solves: most people avoid investing because markets feel abstract and frightening. FundFight makes the consequences of common behavioral mistakes (panic selling, cash hoarding, over-trading) immediately visible and personally felt.

## System Architecture

FundFight is a full-stack Next.js application with four distinct layers:

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Client)                                       │
│  ┌────────────────────┐  ┌──────────────────────────┐  │
│  │  React UI          │  │  Game Engine (TypeScript) │  │
│  │  (shadcn/ui +      │  │  simulation.ts            │  │
│  │   Tailwind CSS)    │  │  portfolio.ts             │  │
│  │                    │  │  events.ts                │  │
│  │                    │  │  projection.ts            │  │
│  │                    │  │  scoring.ts               │  │
│  └────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────┬──────────────────────────┘
                               │ API calls
┌──────────────────────────────▼──────────────────────────┐
│  Next.js API Routes (Server)                            │
│  /api/players  /api/sessions  /api/seeds                │
│  /api/coach    /api/leaderboard  /api/event-choices     │
└──────────────────────┬───────────────┬──────────────────┘
                       │               │
          ┌────────────▼───┐     ┌─────▼────────────┐
          │  Supabase      │     │  Claude Haiku API │
          │  (PostgreSQL)  │     │  (AI Coach)       │
          │  9 tables/views│     │  Streaming SSE    │
          └────────────────┘     └──────────────────┘
```

**Key design decision:** The simulation engine runs entirely client-side in TypeScript. All financial calculations — returns, rebalancing, Monte Carlo projections, scoring — happen in the browser. The server is only responsible for persistence (storing results, fetching price data) and AI coach messages. This makes the game real-time and responsive regardless of network conditions.

## Game Flow

A single game session follows this sequence:

1. **Player setup** — nickname, avatar, device ID stored in Supabase
2. **Scenario selection** — player picks one of four curated 10-year market windows
3. **Price data fetch** — ~21,000 weekly price rows loaded into browser memory
4. **Portfolio builder** — player allocates starting capital across 21 assets
5. **Simulation** — engine runs at 1×/3×/5× speed; 1 tick = 1 week
6. **Life events** — financial decisions fire at predetermined ticks
7. **Results** — composite score, behavioral profile, comparison to benchmark
8. **Leaderboard** — final score posted to global rankings

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Game Engine | Pure TypeScript, client-side |
| Database | Supabase (PostgreSQL) |
| AI Coach | Claude Haiku via Anthropic API (streaming SSE) |
| Package Manager | Yarn 4.6 (monorepo workspaces) |
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/index.mdx
git commit -m "docs: add overview page"
```

---

## Task 10: Write market-data.mdx

**Files:**
- Create: `app/content/docs/market-data.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: Market Data & Scenarios
description: How real historical price data is stored, how scenarios (seeds) work, and how data is fetched for a game session.
---

## Plain English

FundFight uses real historical market data — not simulated prices. The game selects a 10-year window of actual weekly prices across 21 investable assets, covering indices, stocks, bonds, gold, and currencies. Players make decisions using the same data that governed real portfolios during that period.

## The Asset Universe

The platform supports 21 tradable assets across four classes:

| Class | Examples | Risk Level |
|-------|---------|-----------|
| `equity_index` | SMI, Euro Stoxx 50, S&P 500, DJIA | 3–4 |
| `stock` | Nestlé, Novartis, Roche, Apple, Microsoft | 4–5 |
| `bond` | Swiss Government Bond index | 1–2 |
| `gold` | Gold priced in CHF | 2–3 |

Assets are stored in the `assets` table in Supabase:

```ts
interface Asset {
  id: string;           // e.g. "smi", "ch_bond", "gold_chf"
  name: string;         // human-readable label
  asset_class: "equity_index" | "stock" | "bond" | "gold";
  region: "CH" | "EU" | "US" | "global";
  ticker: string | null;
  description: string;
  risk_level: number;   // 1 (low) to 5 (high)
}
```

## Price Data

Historical prices are stored in the `weekly_prices` table — approximately 21,000 rows covering ~20 years of weekly data (2006–2026):

```ts
interface WeeklyPrice {
  asset_id: string;   // foreign key → assets.id
  week_index: number; // absolute week number (0 = earliest in dataset)
  date: string;       // ISO date of that week
  price: number;      // closing price in CHF
}
```

When a game session begins, all prices for a selected scenario are loaded into browser memory as a flat lookup table:

```ts
// In memory during a game:
Record<string, number[]>
// e.g. { "smi": [7200, 7215, 7190, ...], "ch_bond": [105.2, 105.4, ...] }
// Index = week offset within the scenario (0 → 519 for a 520-week game)
```

This design means all price lookups during the simulation are O(1) array accesses — no network calls during gameplay.

## Scenarios (Seeds)

A **seed** defines a 10-year slice of market history. There are four curated seeds of increasing difficulty:

```ts
interface Seed {
  id: string;
  name: string;
  start_week: number;      // absolute week index in dataset
  end_week: number;
  total_weeks: number;     // always 520 (10 years × 52 weeks)
  difficulty: "easy" | "medium" | "hard";
  historical_events: HistoricalEvent[]; // flash-card news shown during sim
  crash_weeks: number[];   // relative ticks where market crashes occur
  reveal_title: string;    // shown at game end: "You lived through 2008–2018"
  reveal_text: string;     // narrative context of that period
}
```

Crash weeks are used by the event scheduler to time the `crisis.crash_news` life event to coincide with an actual market downturn in the data — ensuring players experience real panic during real crashes.

## API: Fetching Seeds and Prices

**`GET /api/seeds`** — returns the list of available scenarios sorted by difficulty.

**`GET /api/seeds/[id]/prices`** — fetches all price rows for a specific seed. This is the heaviest query (21 assets × 520 weeks ≈ 11,000 rows), taking 1–3 seconds on first load. The response is transformed client-side into the `Record<string, number[]>` lookup table used by the engine.
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/market-data.mdx
git commit -m "docs: add market data page"
```

---

## Task 11: Write simulation-engine.mdx

**Files:**
- Create: `app/content/docs/simulation-engine.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: The Simulation Engine
description: How the tick loop works, how weekly returns are calculated, and how monthly contributions are applied.
---

## Plain English

The simulation engine is the heart of FundFight. It compresses 10 years of market history into a few minutes of gameplay by running a "tick loop" — each tick represents one week of real time. At every tick, the engine updates portfolio values using real historical prices, applies monthly contributions, and checks whether any life events should fire.

## Initialization

Before the tick loop starts, `initSimulation()` sets up the game state:

```ts
// src/lib/engine/simulation.ts
function initSimulation(config: SimConfig): SimulationState {
  // 1. Create positions from player's chosen allocations
  // e.g. 30% SMI = CHF 3,000 if starting with CHF 10,000
  const positions = allocations.map(a => ({
    assetId: a.assetId,
    pct: a.pct,
    value: startingPortfolio * (a.pct / 100),
  }));

  // 2. Schedule life events at random ticks within valid ranges
  const { events, chainState } = scheduleInitialEvents(seed, totalTicks);

  // 3. Return initial SimulationState
  return { currentTick: 0, totalTicks: 520, positions, ... };
}
```

The full simulation state tracks everything needed to reproduce any moment in the game: portfolio positions, analytics counters, scheduled events, and all historical prices.

## The Tick Loop

`tickSimulation()` is called once per tick. It is a **pure function** — it takes the current state and returns a new state, with no mutations. This makes the simulation deterministic and easy to reason about.

Each tick processes these steps in order:

```
Tick N:
  1. Apply weekly returns to all positions
  2. Compute effective monthly contribution (base ± modifiers from life events)
  3. If tick % 4 === 0 → add monthly contribution (every 4th tick = one month)
  4. Recalculate total portfolio value
  5. Update analytics (peak, drawdown %, cash-heavy counter)
  6. Expire any time-limited contribution modifiers
  7. Check for a scheduled life event at this tick
  8. Check for a historical news flash at this tick
  9. Check completion (tick >= 520)
```

## Return Calculation

At each tick, every non-cash position is updated using the actual price change for that week:

```ts
// portfolio.ts
newValue = currentValue × (priceNow / pricePrev)

// Which is equivalent to:
newValue = currentValue × (1 + weeklyReturn)
// where weeklyReturn = (priceNow - pricePrev) / pricePrev
```

Cash earns no return — it is a zero-yield position by design, to discourage hoarding.

## Monthly Contributions

The player sets a monthly contribution at game start (e.g. CHF 500/month). Every 4th tick, this amount is distributed across all positions proportionally to their current value:

```ts
// applyContribution(positions, amount)
positions.map(pos => ({
  ...pos,
  value: pos.value + amount × (pos.value / totalPortfolio)
}))
```

Life events can modify the contribution temporarily or permanently. For example, taking a severance package reduces contributions by CHF 200/month for 50 ticks (~1 year). These are tracked as `ContributionModifier` objects with optional expiry ticks.

## Speed Modes

The UI hook runs a `setInterval` at different rates:
- **1× speed**: 800ms per tick (1 week = 0.8 seconds)
- **3× speed**: 267ms per tick
- **5× speed**: 160ms per tick

At 5× speed, a full 10-year simulation completes in ~83 seconds.

## Analytics Tracking

Every tick updates key behavioral metrics used for scoring:

| Metric | How it's tracked |
|--------|-----------------|
| `peakPortfolio` | Running maximum of `totalPortfolio` |
| `currentDrawdownPct` | `(peak - current) / peak × 100` |
| `maxDrawdownPct` | Running maximum of `currentDrawdownPct` |
| `cashHeavyWeeks` | Counter: +1 if cash > 50% of portfolio this tick |
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/simulation-engine.mdx
git commit -m "docs: add simulation engine page"
```

---

## Task 12: Write portfolio-management.mdx

**Files:**
- Create: `app/content/docs/portfolio-management.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: Portfolio Management
description: How rebalancing works, how panic sells are detected, and how the benchmark baseline is calculated.
---

## Plain English

Players can rebalance their portfolio at any time during the simulation — shifting allocation percentages between assets. The engine detects when a rebalance looks like an emotional panic reaction (selling during a crash) and penalises it in the final score. A silent benchmark portfolio runs in parallel to give players a reference point: "how would you have done if you'd never touched anything?"

## Rebalancing

When the player submits new allocation percentages, `rebalancePortfolio()` is called:

```ts
// portfolio.ts
function rebalancePortfolio(
  totalValue: number,
  newAllocations: Array<{ assetId: string; pct: number }>
): PortfolioPosition[] {
  return newAllocations.map(a => ({
    assetId: a.assetId,
    pct: a.pct,
    value: totalValue * (a.pct / 100),
  }));
}
```

This is a full redistribution — the total portfolio value is preserved, but each position's value is recalculated from scratch based on the new percentage. There are no transaction costs modelled (simplification for the game context).

## Panic Sell Detection

After every rebalance, the engine checks whether it qualifies as a panic rebalance:

```ts
// simulation.ts – handleRebalance()
const isPanic =
  state.currentDrawdownPct > 15           // portfolio is down >15% from peak
  && newSafePct - prevSafePct > 20;       // cash/bonds allocation jumped >20pp
```

Safe assets are: `cash`, `ch_bond` (Swiss government bonds), `gold_chf`.

If both conditions are true, `panicRebalances` is incremented. Each panic rebalance deducts 15 points from the discipline score.

**Why this matters educationally:** panic selling (converting to safe assets during a downturn) is the most common and costly investing mistake. By naming it, measuring it, and penalising it, FundFight makes the abstract concept visceral.

## Lump Sum Operations

Life events can add or remove lump sums from the portfolio. `applyLumpSum()` distributes the change proportionally across all positions:

```ts
// portfolio.ts
positions.map(pos => ({
  ...pos,
  value: Math.max(0, pos.value + amount × (pos.value / totalPortfolio))
}))
```

A positive `amount` adds to the portfolio (e.g. inheritance); negative subtracts (e.g. medical bill, relocation costs). Values are clamped to 0 — no negative position values.

## Panic Sell (Move All to Cash)

The `crisis.crash_news` event gives players the option to sell everything immediately:

```ts
// portfolio.ts
function moveAllToCash(positions): PortfolioPosition[] {
  const total = getTotalPortfolio(positions);
  return positions.map(pos =>
    pos.assetId === "cash"
      ? { ...pos, value: total, pct: 100 }
      : { ...pos, value: 0, pct: 0 }
  );
}
```

This is deliberately irreversible within the event — they must manually rebalance back. The delay teaches how hard it is to time re-entry into markets after panic selling.

## The Benchmark

A "do nothing" baseline portfolio runs silently alongside every game session. It is initialised with the player's starting allocation and never rebalanced, never receives life event effects, but does receive monthly contributions at the base rate.

`benchmarkFinal` is the value this portfolio would have reached at tick 520. It serves as the denominator for the portfolio component of the composite score:

```
portfolioScore = min(finalPortfolio / benchmarkFinal × 80, 100)
```

Matching the benchmark earns 80 points; beating it by 25% earns the maximum 100. This calibration ensures simply "doing nothing" is already a good outcome — reinforcing the long-term investing message.
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/portfolio-management.mdx
git commit -m "docs: add portfolio management page"
```

---

## Task 13: Write life-events.mdx

**Files:**
- Create: `app/content/docs/life-events.mdx`

- [ ] **Step 1: Read events.ts to confirm all event keys before writing**

File: `app/src/lib/engine/events.ts` — confirm the `LIFE_EVENTS` record contains these keys:
- `career.opportunity`, `career.promotion`, `career.stagnation`
- `personal.housing`, `personal.health`, `personal.renovation`
- `crisis.crash_news`, `crisis.windfall`

- [ ] **Step 2: Create the file**

````mdx
---
title: Life Event System
description: How life events are defined, scheduled, and chained, and how player choices affect the portfolio.
---

## Plain English

Throughout the simulation, players face life events — realistic financial decisions that interrupt gameplay and force trade-offs. A career opportunity, a medical emergency, a market crash, an unexpected inheritance. Each event has two options with different financial consequences, and some events trigger follow-up events based on the player's choice, creating branching narrative chains.

## Event Definition

Every life event is defined by its effects on the portfolio and/or monthly contribution:

```ts
interface LifeEventDefinition {
  key: string;           // e.g. "career.opportunity"
  chain: "career" | "personal" | "crisis";
  title: string;
  description: string;
  optionA: { label: string; hint: string; effect: EventEffect };
  optionB: { label: string; hint: string; effect: EventEffect };
}

interface EventEffect {
  portfolioChange?: number;       // lump sum: positive = add, negative = withdraw
  contributionChange?: number;    // monthly delta (permanent or temporary)
  contributionDuration?: number;  // ticks until modifier expires (null = permanent)
  moveAllToCash?: boolean;        // special: panic sell everything
  description: string;
}
```

## The Events

Events are grouped into three chains:

### Career Chain

| Event | Option A | Option B |
|-------|---------|---------|
| **Career Opportunity** — competitor offers 30% raise, CHF 5k relocation cost | Take the job: −CHF 5k portfolio, +CHF 150/mo permanent | Stay: no change |
| **Promotion** *(follows A above)* — leadership role, CHF 3k dev cost | Accept: −CHF 3k, +CHF 100/mo | Decline: no change |
| **Company Downsizing** *(follows B above)* — restructuring | Take severance +CHF 8k, −CHF 200/mo for ~1 year | Reduced hours: −CHF 100/mo permanent |

### Personal Chain

| Event | Option A | Option B |
|-------|---------|---------|
| **Property Opportunity** — first apartment, CHF 15k down payment | Buy: −CHF 15k portfolio | Keep renting: −CHF 100/mo permanent |
| **Medical Emergency** — CHF 6k out-of-pocket | Sell investments: −CHF 6k | Payment plan: −CHF 250/mo for ~6 months |
| **Home Repair Crisis** *(follows buying above)* — roof, CHF 8k | Sell: −CHF 8k | Renovation loan: −CHF 150/mo for ~10 months |

### Crisis Chain

| Event | Option A | Option B |
|-------|---------|---------|
| **Markets in Freefall** — crash news, panic | Sell everything → move all to cash | Stay the course: no change |
| **Unexpected Inheritance** — CHF 10k windfall | Invest all: +CHF 10k | Split: +CHF 5k invested, +CHF 5k cash |

## Scheduling

Events are scheduled at `initSimulation()` using random ticks within constrained ranges:

```ts
// events.ts – scheduleInitialEvents()
const raw = [
  { key: "career.opportunity", tick: randBetween(40, 80) },    // ~years 1–2
  { key: "personal.housing",   tick: randBetween(100, 180) },  // ~years 2–4
  { key: "personal.health",    tick: randBetween(250, 350) },  // ~years 5–7
  { key: "crisis.crash_news",  tick: crashTick },               // from seed data
  { key: "crisis.windfall",    tick: randBetween(350, 450) },  // ~years 7–9
];
```

Events are sorted by tick and separated by at least 15 ticks to avoid overlap. The crash event tick is taken directly from the seed's `crash_weeks` data — ensuring the market crash event fires when the price data is actually crashing.

## Event Chaining

After the player makes a choice, `scheduleFollowUpEvent()` determines whether a follow-up should be queued:

```
career.opportunity + chose A → queue career.promotion  (100–170 ticks later)
career.opportunity + chose B → queue career.stagnation (120–200 ticks later)
personal.housing   + chose A → queue personal.renovation (150–250 ticks later)
```

Chain state is tracked in `chainState` — a record of flags like `tookNewJob`, `boughtProperty`, `panicSold` — which feeds into behavioral profile detection and scoring.

## Applying Effects

`applyEventEffect()` is called immediately when the player chooses an option:

1. **Portfolio change** → `applyLumpSum(positions, amount)` — distributes proportionally
2. **Move all to cash** → `moveAllToCash(positions)` — collapses everything
3. **Contribution change** → adds a `ContributionModifier` with optional expiry tick
4. **Chain state update** → sets flags (e.g. `chainState.career.tookNewJob = true`)
````

- [ ] **Step 3: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/life-events.mdx
git commit -m "docs: add life events page"
```

---

## Task 14: Write monte-carlo.mdx

**Files:**
- Create: `app/content/docs/monte-carlo.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: Monte Carlo Projections
description: How the projection cone is calculated using Geometric Brownian Motion and 200 simulated paths.
---

## Plain English

While the simulation replays known historical prices, the projection cone shows players where their portfolio *might* go in the future — using 200 randomly simulated paths based on recent market behaviour. The cone's width reflects uncertainty: a diversified portfolio shows a tighter cone than an all-equity one. Players see this update live as they rebalance or face events, making the risk/reward trade-off tangible.

## The Method: Geometric Brownian Motion

The projection uses **Geometric Brownian Motion (GBM)** — the same stochastic model underlying the Black-Scholes options pricing formula. It models asset prices as log-normally distributed, which correctly captures that prices can't go below zero and that percentage returns (not absolute returns) follow a normal distribution.

### Step 1: Estimate portfolio drift (μ) and volatility (σ)

For each position in the current portfolio, the engine looks at the last 52 weeks of actual price data and computes log returns:

```ts
logReturn_t = ln(price_t / price_{t-1})
```

From these, it calculates the weekly mean return and weekly variance. These are then annualised:

```ts
muAnnualized    = meanWeekly × 52
sigmaAnnualized = sqrt(variance × 52)  // realized volatility
```

The portfolio-level μ and σ are computed as value-weighted averages across all non-cash positions:

```ts
muPortfolio    += weight_i × mu_i
sigmaPortfolio += weight_i × sigma_i
```

If fewer than 8 weeks of price history exist (early in the game), fallback values are used: μ = 6%, σ = 15%.

### Step 2: Convert to weekly GBM parameters

```ts
weeklyMu    = muPortfolio / 52
weeklySigma = sigmaPortfolio / sqrt(52)
```

### Step 3: Simulate 200 paths

For each of 200 paths, the engine steps forward tick-by-tick using the GBM formula:

```ts
value_t = value_{t-1} × exp(weeklyMu - 0.5 × weeklySigma² + weeklySigma × Z)
```

Where `Z` is a standard normal random variable (Box-Muller transform). Monthly contributions are added every 4 ticks.

Values are stored at monthly granularity (every 4th tick) to keep memory usage bounded.

### Step 4: Compute percentiles

At each stored time point, the 200 path values are sorted and percentiles extracted:

| Percentile | Meaning |
|-----------|---------|
| p5 | Bottom 5% of outcomes — "bad luck" scenario |
| p25 | Lower quartile |
| p50 | Median — most likely outcome |
| p75 | Upper quartile |
| p95 | Top 5% — "good luck" scenario |

The resulting cone (p5 to p95) is displayed as a shaded area chart in the UI.

## Target Probability

The engine also computes the probability of reaching the player's savings target:

```ts
target = currentPortfolio + monthlyContribution × remainingMonths
targetProbability = (paths where finalValue > target) / 200 × 100
```

This gives players a simple "X% chance of reaching your goal" number that updates in real time.

## Performance

Running 200 GBM paths × 520 ticks = 104,000 iterations in the browser. With Float64Array buffers and no object allocation inside the loop, this completes in under 50ms on modern hardware. The projection is recalculated every 4 ticks (monthly) and immediately after any rebalance.
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/monte-carlo.mdx
git commit -m "docs: add monte carlo page"
```

---

## Task 15: Write scoring.mdx

**Files:**
- Create: `app/content/docs/scoring.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: Scoring & Behavioral Profiles
description: How the composite score is calculated and how players are classified into one of six behavioral archetypes.
---

## Plain English

At the end of each game, players receive a score out of 100 and are assigned a behavioral profile. The score rewards three things: beating the benchmark (portfolio performance), staying disciplined (avoiding panic and cash hoarding), and making good decisions during life events. The profile names what kind of investor the player's behavior resembled — from "Diamond Hands" to "Panic Seller".

## Composite Score Formula

The composite score is a weighted average of three sub-scores, each on a 0–100 scale:

```
compositeScore = portfolioScore × 0.40
              + disciplineScore × 0.35
              + eventScore × 0.25
```

### Portfolio Score (40% weight)

Measures how well the player performed relative to the "do nothing" benchmark:

```ts
const ratio = finalPortfolio / benchmarkFinal;
const portfolioScore = Math.min(ratio * 80, 100);
```

| Performance | Score |
|------------|-------|
| Matching benchmark exactly | 80 |
| Beating benchmark by 25% | 100 (max) |
| Below benchmark | Proportionally lower |

**Calibration intent:** Even passive investors who do nothing score 80 on this dimension. The 25% outperformance threshold for 100 is deliberately high — few active strategies reliably beat a passive benchmark.

### Discipline Score (35% weight)

Measures behavioral quality — the absence of costly mistakes:

```ts
let disciplineScore = 100;
disciplineScore -= panicRebalances × 15;           // −15 per panic rebalance
disciplineScore -= (cashHeavyWeeks / totalWeeks) × 30; // up to −30 for cash hoarding
disciplineScore -= Math.max(0, totalRebalances - 5) × 3; // −3 per rebalance above 5
disciplineScore = Math.max(0, disciplineScore);    // floor at 0
```

| Behaviour | Penalty |
|-----------|---------|
| Each panic rebalance | −15 points |
| 100% cash-heavy weeks | −30 points (pro-rated) |
| Each rebalance above 5 total | −3 points |

### Event Score (25% weight)

Rewards smart choices during life events. Events that teach the most important lessons are weighted higher:

| Event | Optimal choice | Points |
|-------|---------------|--------|
| `crisis.crash_news` | Stay the course (option B) | 25 |
| `career.opportunity` | Take the job (option A) | 15 |
| `crisis.windfall` | Invest all (option A) | 10 |
| All other events | — | 5 each |

The raw points are normalised to 0–100 against the maximum possible score for the events that actually fired. If no events fired, the event score defaults to 50 (neutral).

## Behavioral Profiles

After scoring, `detectBehavioralProfile()` classifies the player using a priority-ordered set of rules:

```ts
// Priority order matters — first match wins
if (panicRebalances >= 1 && chainState.crisis.panicSold)
  return "panic_seller";

if (cashHeavyWeeks >= totalWeeks * 0.3)   // cash > 50% for 30%+ of weeks
  return "cash_hoarder";

if (totalRebalances >= 8)
  return "overthinker";

if (finalPortfolio > benchmarkFinal && panicRebalances === 0)
  return "strategist";

if (totalRebalances <= 2 && cashHeavyWeeks < totalWeeks * 0.1)
  return "diamond_hands";

return "momentum_chaser";  // fallback
```

### Profile Descriptions

| Profile | Behaviour | Educational message |
|---------|-----------|-------------------|
| **Panic Seller** | Sold during the crash, fled to safety | Fear drives the biggest financial mistakes |
| **Cash Hoarder** | Held >50% cash for extended periods | Cash feels safe but inflation erodes it |
| **Overthinker** | Made 8+ rebalances | Friction costs compound; less is often more |
| **Strategist** | Beat benchmark without panic | Rare skill — or lucky timing |
| **Diamond Hands** | Barely touched portfolio | Boring but consistently effective |
| **Momentum Chaser** | Active but no dominant pattern | Stayed engaged; mixed results |

## Educational Design Intent

The scoring formula is deliberately calibrated to make the "boring" strategy — low rebalancing, no panic, passive allocation — score well. This reinforces PostFinance's educational goal: long-term, low-intervention investing beats reactive decision-making.
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/scoring.mdx
git commit -m "docs: add scoring page"
```

---

## Task 16: Write ai-coach.mdx

**Files:**
- Create: `app/content/docs/ai-coach.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: AI Coach
description: How the AI investment coach works — when it triggers, how prompts are built, and how responses are streamed to the browser.
---

## Plain English

FundFight includes an AI investment coach powered by Claude Haiku. The coach appears at key moments during gameplay — when the market crashes, before a life event decision, after a panic rebalance — and delivers short, personalised commentary in 2–3 sentences. It speaks like a knowledgeable friend, not a professor: using the player's actual numbers, explaining concepts without jargon, and never telling them what to do.

## Trigger Types

The coach fires on ten distinct triggers:

| Trigger | When it fires |
|---------|--------------|
| `game_start` | Player begins the simulation |
| `market_crash` | Historical crash event fires (prices drop significantly) |
| `market_recovery` | Portfolio recovers after a crash |
| `life_event_before` | Before the player sees an event's options |
| `life_event_after` | After the player makes an event choice |
| `panic_rebalance` | Player moves heavily to cash/bonds during a drawdown |
| `all_in_equity` | Player moves to high equity allocation |
| `cash_heavy` | Player has held >50% cash for extended period |
| `milestone` | Portfolio hits a significant growth milestone |
| `game_end` | Simulation complete — personalised reflection |

An 8-second cooldown prevents messages from overlapping (except `game_end`, which always fires).

## Prompt Construction

Every coach message is built server-side by `buildCoachPrompt()` in `src/lib/engine/coach-prompts.ts`. It receives a `CoachContext` object containing live game state, then constructs a tailored user prompt for that trigger.

Example for `panic_rebalance`:

```
The player just shifted heavily toward cash/bonds during a market drawdown of 18.3%.
They've now got 72% in cash. This is their 1st panic rebalance.
Gently explain the concept of "selling low" and why it usually hurts long-term returns.
Be empathetic, not preachy.
```

The system prompt establishes the coach's persona — a friendly financial educator, never prescriptive, always referencing the player's actual numbers.

## Streaming SSE Delivery

The `/api/coach` endpoint forwards the prompt to the Claude Haiku API with `stream: true`, then re-streams the response as Server-Sent Events to the browser:

```
POST /api/coach
Body: CoachContext (trigger + portfolio state + event data)

Response: text/event-stream
data: {"text": "Markets "}
data: {"text": "can be "}
data: {"text": "terrifying..."}
```

The server acts as a passthrough proxy — it receives Anthropic's SSE stream, extracts `content_block_delta` events, and re-emits them in a simplified format. This avoids exposing the Anthropic API key to the browser.

## Technical Details

- **Model:** `claude-haiku-4-5-20251001` — chosen for speed and cost; responses arrive in 1–2 seconds
- **Max tokens:** 200 — enforces the 2–3 sentence constraint
- **No message history:** each trigger is a fresh, stateless call — the coach has no memory of previous messages
- **Client handling:** the `useCoach` hook manages the SSE connection, assembles streamed tokens into a full message, and exposes `currentMessage` and `messageHistory` to the UI
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/ai-coach.mdx
git commit -m "docs: add AI coach page"
```

---

## Task 17: Write api-reference.mdx

**Files:**
- Create: `app/content/docs/api-reference.mdx`

- [ ] **Step 1: Create the file**

````mdx
---
title: API Reference
description: All API endpoints and the Supabase database schema.
---

## API Endpoints

All endpoints are Next.js API routes under `src/app/api/`. The server uses a Supabase service-role client for write operations and the anon key for reads.

### `POST /api/players`

Creates or retrieves a player by device ID (stored in browser localStorage).

**Request body:**
```json
{ "device_id": "uuid", "nickname": "AlphaFund", "avatar": "🦅" }
```

**Response:** Full player object. If `device_id` already exists, returns the existing player (upsert pattern — idempotent).

---

### `POST /api/sessions`

Starts a new game session.

**Request body:**
```json
{
  "player_id": "uuid",
  "seed_id": "uuid",
  "starting_portfolio": 10000,
  "monthly_contribution": 500
}
```

**Response:** `{ "session_id": "uuid" }`

---

### `PUT /api/sessions/[id]`

Records the final results of a completed session.

**Request body:**
```json
{
  "final_portfolio": 14320,
  "composite_score": 72.5,
  "behavioral_profile": "diamond_hands",
  "total_rebalances": 2,
  "panic_rebalances": 0,
  "cash_heavy_weeks": 8,
  "max_drawdown_pct": 22.4,
  "benchmark_final": 13800,
  "chain_state": { ... },
  "duration_seconds": 184
}
```

---

### `GET /api/seeds`

Returns available scenarios sorted by difficulty (easy → hard).

**Response:** Array of seed objects (id, name, difficulty, description, reveal_title).

---

### `GET /api/seeds/[id]/prices`

Returns all weekly price data for a scenario. ~11,000 rows.

**Response:** Array of `{ asset_id, week_index, price }` objects. Transformed client-side into `Record<string, number[]>`.

---

### `POST /api/event-choices`

Records a player's life event choice for analytics. Fire-and-forget.

**Request body:**
```json
{ "session_id": "uuid", "event_key": "crisis.crash_news", "chosen": "b", "portfolio_at_choice": 9800 }
```

A Supabase database trigger automatically updates the `event_choice_stats` aggregation table.

---

### `GET /api/event-stats/[key]`

Returns social proof statistics for a specific event.

**Response:**
```json
{ "option_a_pct": 34, "option_b_pct": 66, "total_choices": 142 }
```

Shown to players after they make their choice: "66% of players stayed the course."

---

### `GET /api/leaderboard`

Returns top players by composite score. Accepts optional `?seed_id=` filter.

**Response:** Array of `LeaderboardEntry` objects (nickname, avatar, score, profile, portfolio).

---

### `POST /api/coach`

Streams an AI coach message. See [AI Coach](/docs/ai-coach) for details.

---

## Database Schema

All tables live in Supabase (PostgreSQL). The schema uses UUIDs for all primary keys.

| Table | Rows | Purpose |
|-------|------|---------|
| `assets` | 21 | Asset definitions (name, class, region, risk level) |
| `weekly_prices` | ~21,000 | Historical prices indexed by asset + week |
| `seeds` | 4 | Scenario definitions (time windows, difficulty, events) |
| `players` | grows | Player identity (device_id, nickname, avatar) |
| `game_sessions` | grows | One row per completed game (scores, profile, state) |
| `portfolio_snapshots` | grows | Portfolio allocations at key moments |
| `event_choices` | grows | Individual event choice records |
| `event_choice_stats` | 8 | Auto-aggregated A/B split per event (DB trigger) |
| `leaderboard` | — | **View** (not table): top sessions by score |

### Key relationship: game_sessions

```
players ──< game_sessions ──< portfolio_snapshots
             │
             └──< event_choices
```

`game_sessions.chain_state` is stored as JSONB — the full `ChainState` object capturing which career/personal/crisis paths the player took.
````

- [ ] **Step 2: Commit**

```bash
cd /Users/apple/Documents/starthack
git add app/content/docs/api-reference.mdx
git commit -m "docs: add API reference page"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/apple/Documents/starthack/app
yarn dev
```

- [ ] **Step 2: Check each route loads**

Visit in browser:
- `http://localhost:3000/docs` — Overview page with sidebar
- `http://localhost:3000/docs/simulation-engine` — Simulation Engine
- `http://localhost:3000/docs/scoring` — Scoring with formula tables
- `http://localhost:3000/docs/api-reference` — API Reference

All pages should render with: sidebar navigation, page title, table of contents, and formatted content.

- [ ] **Step 3: Check for TypeScript/build errors**

```bash
cd /Users/apple/Documents/starthack/app
yarn build
```

Expected: successful build with no errors. Warnings about missing env vars are acceptable.

- [ ] **Step 4: Stop dev server and commit**

```bash
cd /Users/apple/Documents/starthack
git add -A
git commit -m "docs: complete fumadocs integration and all content pages"
```
