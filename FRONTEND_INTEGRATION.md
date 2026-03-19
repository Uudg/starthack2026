# Frontend Integration Guide

This doc explains how the frontend connects to everything already built. The server logic, API, game engine, hooks, and database are all done. Your job is to build the UI that consumes them.

---

## What's Already Built (Don't Touch Unless Broken)

```
lib/
  supabase/
    server.ts              ← Supabase client for API routes (service role key)
    client.ts              ← Supabase client for browser (anon key, reads only)
  types.ts                 ← Every TypeScript type used in the app
  engine/
    simulation.ts          ← Main engine: init, tick, rebalance, event handling
    portfolio.ts           ← Portfolio math: returns, rebalance, contributions
    events.ts              ← Life event definitions + chain scheduler
    benchmark.ts           ← Pre-computes the "do nothing" baseline
    scoring.ts             ← Composite score + behavioral profile detection
    projection.ts          ← Monte Carlo projection cone
  hooks/
    usePlayer.ts           ← Player identity (device ID + nickname + avatar)
    useSeedData.ts         ← Fetches seed list + price data
    useGameEngine.ts       ← THE main hook: game loop, timer, all actions
    useLeaderboard.ts      ← Fetches leaderboard entries
  store/
    game-context.tsx       ← React context wrapping the engine hook

app/
  api/                     ← 8 API route handlers (all working, tested)
    players/route.ts
    seeds/route.ts
    seeds/[id]/prices/route.ts
    sessions/route.ts
    sessions/[id]/route.ts
    event-stats/[key]/route.ts
    event-choices/route.ts
    leaderboard/route.ts
```

**Supabase tables** (all populated, all working):

- `assets` — 21 tradable assets with metadata
- `weekly_prices` — ~21,000 weekly price rows (2006–2026)
- `seeds` — 4 curated 10-year scenarios
- `seed_assets` — junction table
- `players` — nicknames + avatars
- `game_sessions` — each playthrough with results
- `portfolio_snapshots` — allocation at key moments
- `event_choices` — life event decisions
- `event_choice_stats` — aggregated percentages (auto-updates via DB trigger)
- `leaderboard` — a VIEW, not a table

---

## The One Thing You Need to Set Up

Wrap your app in the `GameProvider`. In `app/layout.tsx` (or wherever the game routes live):

```tsx
import { GameProvider } from "@/lib/store/game-context";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GameProvider>{children}</GameProvider>;
}
```

After this, every component inside can call `useGame()` and get everything.

---

## How the App Works (The Mental Model)

The entire app is driven by a single `phase` variable. The phase tells you which screen to show. The engine manages phase transitions automatically — you almost never set the phase manually.

```
phase flow:

  'idle' → 'onboarding' → 'portfolio' → 'paused' → 'simulating' ↔ 'paused'
                                                          ↓
                                                       'event' (modal overlay)
                                                          ↓
                                                       'simulating' (resumes)
                                                          ↓
                                                       'completing' → 'results'
```

Your page component is essentially a phase router:

```tsx
"use client";
import { useGame } from "@/lib/store/game-context";

export default function GamePage() {
  const { phase } = useGame();

  switch (phase) {
    case "idle":
    case "onboarding":
      return <OnboardingScreen />;
    case "portfolio":
      return <PortfolioBuilderScreen />;
    case "paused":
    case "simulating":
      return <SimulationScreen />;
    case "event":
      return <SimulationScreen />; // same screen, but with event modal on top
    case "completing":
      return <LoadingSpinner />;
    case "results":
      return <ResultsScreen />;
  }
}
```

**Important:** The phase transitions from `'simulating'` to `'event'` and back happen automatically inside the engine. When a life event triggers, the timer stops, phase becomes `'event'`, and it waits for the player to call `chooseEventOption('a' | 'b')`. After the choice, phase goes back to `'simulating'` and the timer restarts. You don't manage any of this — just show/hide the modal based on phase.

---

## Screen-by-Screen: What Data You Have and What Actions to Call

### Screen 1: Onboarding

**Purpose:** Collect nickname, avatar, and basic profile.

**Hooks you need:**

```tsx
const { player, loading, createPlayer } = usePlayer();
const { availableSeeds, fetchSeeds } = useSeedData();
```

**On mount:** Call `fetchSeeds()` to load the seed list. Check if `player` already exists (returning user).

**What the user fills in:**

- Nickname (text input)
- Avatar (pick from a grid — just emoji strings like '🐻', '🦊', '🐸', etc.)
- Starting portfolio (presets: CHF 5,000 / 10,000 / 25,000 or custom)
- Monthly contribution (slider: CHF 0–500, step 50)
- Seed selection (show the 4 seeds with name + difficulty badge, or pick randomly for them)

**When they submit:**

```tsx
const handleSubmit = async () => {
  const p = await createPlayer(nickname, avatar);
  // Store the profile values in local state or context
  // Transition to portfolio screen
  // You manage this transition yourself — set some local state like setScreen('portfolio')
};
```

**Note on phase:** The engine doesn't manage onboarding phase automatically. You handle the onboarding → portfolio transition yourself with local state. The engine's phase only kicks in after `startGame()` is called.

**Seed data fetching:** After the user picks a seed (or you pick one for them), call:

```tsx
const { seedData, fetchSeedData } = useSeedData();
await fetchSeedData("alpine-storm");
// seedData now has: { seed, assets, prices, dates }
```

This is the big fetch — ~11,000 price rows. Show a loading state. It takes 1–3 seconds depending on connection. Do this BEFORE the portfolio screen so the user doesn't wait later.

---

### Screen 2: Portfolio Builder

**Purpose:** Player picks their asset allocation before the simulation starts.

**What you have available:**

```tsx
const { seedData } = useSeedData();
// seedData.assets → array of 21 Asset objects
// Each has: id, name, asset_class, region, risk_level, description
```

**What the user does:**

- Sees assets grouped by class: Equity Indices, Swiss Stocks, US Stocks, Bonds, Gold
- Picks which assets they want in their portfolio (checkboxes or cards)
- Sets percentage allocation for each selected asset (sliders that sum to 100)
- Must always have a "Cash" position (even if 0%)
- The sum of all percentages must equal 100 — validate this in the UI

**The allocation data structure:**

```typescript
// This is what you'll pass to startGame()
const allocations = [
  { assetId: "smi", pct: 30 },
  { assetId: "ch_bond", pct: 25 },
  { assetId: "gold_chf", pct: 15 },
  { assetId: "nestle", pct: 15 },
  { assetId: "apple", pct: 10 },
  { assetId: "cash", pct: 5 },
];
// Must sum to 100
```

**When they confirm:**

```tsx
const { startGame } = useGame();
const { player } = usePlayer();
const { seedData } = useSeedData();

const handleStart = async () => {
  await startGame({
    playerId: player.id,
    seed: seedData.seed,
    assets: seedData.assets,
    prices: seedData.prices,
    startingPortfolio: 10000, // from onboarding
    monthlyContribution: 200, // from onboarding
    allocations: allocations, // from this screen
  });
  // Phase automatically becomes 'paused'
  // The simulation is ready but not running yet
};
```

**After startGame():**

- `phase` becomes `'paused'`
- `state` is populated with the initial SimulationState
- `projection` has the initial cone data
- `benchmarkFinal` has the benchmark number
- The player sees the simulation screen with a "Play" button

**Optional: Projection preview.** You can call the projection engine directly to show a preview cone as the user adjusts allocation — but this isn't wired through the main hook. You'd import `calculateProjection` from the engine and call it manually with the draft allocation. Nice to have, not required.

---

### Screen 3: Simulation (The Main Game Screen)

This is the most complex screen. Here's every piece of data available to you.

**The hook gives you everything:**

```tsx
const {
  phase, // 'simulating' | 'paused' | 'event'
  state, // full SimulationState (see below)
  projection, // { percentiles: { p5, p25, p50, p75, p95 }, medianFinal, targetProbability }
  historicalNews, // { week, name, type } | null — flashes for ~5 seconds
  activeEvent, // LifeEventDefinition | null — the current life event
  activeEventStats, // { total, optionAPct, optionBPct } | null — social proof
  currentYear, // 1-10
  currentWeekInYear, // 1-52
  progressPct, // 0-100
  elapsedSeconds, // real-world seconds elapsed

  // Actions
  play, // () => void — start/resume the timer
  pause, // () => void — stop the timer
  setSpeed, // (1 | 3 | 5) => void
  rebalance, // (newAllocations) => void
  chooseEventOption, // ('a' | 'b') => Promise<void>
} = useGame();
```

**Inside `state` (SimulationState), the fields you'll display:**

```
state.currentTick          — current week number (0-520)
state.totalTicks           — total weeks (520 for 10-year)
state.positions            — array of { assetId, pct, value, units } for each held asset
state.totalPortfolio       — sum of all positions (the big number)
state.cashValue            — cash bucket specifically
state.effectiveContribution — current monthly contribution after modifiers
state.baseContribution     — original contribution (before life events modified it)
state.contributionModifiers — array of active modifiers with reasons and amounts
state.currentDrawdownPct   — how far below the peak the portfolio currently is
state.peakPortfolio        — highest portfolio value reached so far
state.totalRebalances      — how many times the player has rebalanced
state.speed                — current speed setting (1, 3, or 5)
state.scheduledEvents      — upcoming events (don't show these to the player!)
state.triggeredEvents      — past events with before/after portfolio values
state.chainState           — which life choices have been made
```

**What goes on the simulation screen (suggested layout):**

**Top bar — stats:**

- Total portfolio value (the biggest number on screen)
- Year X of 10 (progress)
- Drawdown indicator (show when > 5%: "Down X% from peak")
- Effective monthly contribution (show modifiers if active: "CHF 200 − CHF 100 rent = CHF 100/mo")
- Speed buttons: 1x / 3x / 5x
- Play/Pause button

**Main area — charts:**

- Price chart (left/main): line chart showing price history of each asset up to current tick
  - Data source: `seedData.prices[assetId].slice(0, state.currentTick + 1)` for each asset
  - One line per held asset, colored by asset class
  - X-axis: "Year 1", "Year 2", etc. (every 52 ticks)
  - Y-axis: normalize all prices to base 100 at tick 0 so they're comparable
  - Only show data up to the current tick (progressive reveal)
- Projection cone (right/overlay): area chart showing future probability bands
  - Data source: `projection.percentiles` — p5, p25, p50, p75, p95
  - Each is an array of values from "now" to end of simulation
  - Draw filled bands between symmetric percentiles
  - This shrinks/expands as the user rebalances or events fire

**Bottom bar — allocation controls:**

- Show current allocation as bars or sliders: "SMI 30% (CHF 3,200) | Bonds 25% (CHF 2,680) | ..."
- "Rebalance" button opens an allocation editor (same sliders as portfolio builder)
- Confirming the rebalance calls `rebalance(newAllocations)` — the engine handles everything

**Historical news flash:**

- When `historicalNews` is not null, show a ticker/toast at the top: "📰 Lehman Brothers collapses — global financial crisis"
- It auto-clears after 5 seconds (the hook handles the timeout)
- Don't let the player interact with it — it's informational only

**Chart library:** Use whatever you're comfortable with — Recharts, Chart.js, Visx, or even plain SVG. The data format is just arrays of numbers. For the projection cone, Recharts `<AreaChart>` with stacked areas works well. For the price chart, a simple `<LineChart>` with multiple series.

---

### Life Event Modal (Overlay on Simulation Screen)

**When to show:** When `phase === 'event'` AND `activeEvent !== null`.

The simulation is already paused automatically. You don't need to call `pause()`.

**What you have:**

```tsx
const { activeEvent, activeEventStats, state, chooseEventOption } = useGame();

// activeEvent contains:
activeEvent.icon; // '📰'
activeEvent.title; // 'Markets in Freefall'
activeEvent.description; // 'Breaking news: markets have crashed...'
activeEvent.chain; // 'crisis'
activeEvent.optionA.label; // 'Sell everything — move to cash'
activeEvent.optionA.hint; // 'All positions converted to cash immediately'
activeEvent.optionB.label; // 'Stay the course — ignore the noise'
activeEvent.optionB.hint; // 'No change to portfolio'

// activeEventStats contains (may be null while loading):
activeEventStats.total; // 847 total players
activeEventStats.optionAPct; // 68
activeEventStats.optionBPct; // 32

// Current portfolio context:
state.totalPortfolio; // show this on the modal
state.currentDrawdownPct; // show if > 0
```

**What the modal shows:**

- Icon + title
- Description text
- Current portfolio value
- Two option cards, each with:
  - Label
  - Hint (impact preview)
  - Social proof bar: "██████████░░░░ 68% chose this" (from activeEventStats)
  - Total player count: "847 players faced this decision"
- If stats are still loading (null), show a subtle loading state on the percentage bars or just hide them

**When the player clicks an option:**

```tsx
await chooseEventOption("a"); // or 'b'
// This does everything:
// 1. Applies the financial effect to the simulation state
// 2. Records the choice in Supabase (async, fire-and-forget)
// 3. Clears the active event
// 4. After 1.5 seconds, resumes the simulation timer
// 5. Phase returns to 'simulating'
```

**During the 1.5-second gap** between choosing and resuming, you can show a brief transition: "Projection updated — portfolio is now CHF X" or just a flash animation on the portfolio value.

**Important:** Don't add your own pause/resume logic around events. The engine handles the full lifecycle: pause → show event → player chooses → apply effect → brief pause → resume. If you call `pause()` or `play()` yourself during this flow, you'll conflict with the engine's timer management.

---

### Screen 4: Results

**When to show:** When `phase === 'results'`.

At this point everything has been calculated and submitted to Supabase. You have:

```tsx
const {
  state, // final simulation state
  benchmarkFinal, // what "do nothing" would have produced
  compositeScore, // 0-100 score
  behavioralProfile, // 'panic_seller' | 'diamond_hands' | etc.
  elapsedSeconds, // how long the real session took
  sessionId, // for linking to leaderboard
} = useGame();
```

**For the behavioral profile display**, import the helper:

```tsx
import { getProfileDisplay } from "@/lib/engine/scoring";

const display = getProfileDisplay(behavioralProfile);
// display.name  → "Diamond Hands 💎"
// display.icon  → "💎"
// display.description → "You barely touched your portfolio..."
```

**For the historical reveal**, you have:

```tsx
const { seedData } = useSeedData();
// seedData.seed.reveal_title → "You invested through 2006–2016"
// seedData.seed.reveal_text → "You experienced the worst financial crisis..."
// seedData.seed.historical_events → array of { week, name, type }
```

**For the key moments timeline:**

```tsx
state.triggeredEvents;
// Array of: { key, chain, chosen, tick, portfolioBefore, portfolioAfter }
// Map each to a row:
// "Year 2 — Career Opportunity — Took the job — CHF 10,000 → CHF 5,200"
```

**For the benchmark comparison:**

```tsx
const delta = state.totalPortfolio - benchmarkFinal;
const beatBenchmark = delta > 0;
// "Your portfolio: CHF 18,500"
// "Do-nothing benchmark: CHF 21,000"
// "Your decisions cost you CHF 2,500" (or "You beat the benchmark by CHF X")
```

**Sections to display on results:**

1. Behavioral profile card (big, prominent — icon + name + description)
2. Historical reveal (seed title + reveal text)
3. Numbers: final portfolio, benchmark, delta, composite score
4. Key moments timeline (triggered events in chronological order)
5. Stats: total rebalances, panic rebalances, cash-heavy weeks, max drawdown
6. Leaderboard rank (fetch from the leaderboard hook)
7. "Play Again" button → resets to onboarding (reload the page or reset local state)

---

### Leaderboard (Standalone Page or Tab on Results)

```tsx
const { entries, loading, fetchLeaderboard } = useLeaderboard();

useEffect(() => {
  fetchLeaderboard(); // all seeds
  // or: fetchLeaderboard('alpine-storm')  // specific seed
}, []);
```

Each entry has:

```
entry.nickname
entry.avatar
entry.composite_score
entry.final_portfolio
entry.behavioral_profile
entry.seed_id
entry.duration_seconds
entry.completed_at
```

You can filter by seed (tabs: "All", "Alpine Storm", "Long Summer", etc.) by passing the seed ID to `fetchLeaderboard(seedId)`.

---

## Data Flow Summary

```
Onboarding
  └─ usePlayer().createPlayer() → POST /api/players → Supabase `players`
  └─ useSeedData().fetchSeeds() → GET /api/seeds → Supabase `seeds`

Portfolio Builder
  └─ useSeedData().fetchSeedData(id) → GET /api/seeds/:id/prices → Supabase `weekly_prices`
  └─ User builds allocation (local state only, no API call)

Start Game
  └─ useGame().startGame() → POST /api/sessions → Supabase `game_sessions`
  └─ Engine inits: simulation state, benchmark, projection, event schedule
  └─ All computed client-side, nothing hits the server

During Simulation
  └─ Tick loop runs entirely client-side (setInterval)
  └─ No API calls during normal ticks
  └─ On life event: GET /api/event-stats/:key (social proof, async)
  └─ On event choice: POST /api/event-choices (fire-and-forget)

Game Complete
  └─ Engine calculates score + profile client-side
  └─ PUT /api/sessions/:id → updates Supabase `game_sessions`
  └─ Batch inserts portfolio_snapshots

Leaderboard
  └─ GET /api/leaderboard → Supabase `leaderboard` VIEW
```

**Key principle:** The server is only involved at session boundaries (start, event choices, end). The entire simulation runs client-side with no network dependency. If the internet drops mid-game, the simulation continues normally. Results are submitted when it ends.

---

## Common Patterns You'll Use

### Reading simulation values in a component

```tsx
const { state } = useGame();
if (!state) return null;

const portfolioFormatted = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
  maximumFractionDigits: 0,
}).format(state.totalPortfolio);
```

### Building a chart from price data

```tsx
const { seedData } = useSeedData();
const { state } = useGame();

// Price chart: normalize to base 100 and slice to current tick
const chartData = Array.from({ length: state.currentTick + 1 }, (_, tick) => {
  const point: Record<string, number> = { tick };
  for (const pos of state.positions) {
    if (pos.assetId === "cash") continue;
    const prices = seedData.prices[pos.assetId];
    if (prices && prices[0]) {
      point[pos.assetId] = (prices[tick] / prices[0]) * 100;
    }
  }
  return point;
});
// Each row: { tick: 0, smi: 100, gold_chf: 100, nestle: 100, ... }
// At tick 50: { tick: 50, smi: 94.3, gold_chf: 112.1, ... }
```

### Building the projection cone for a chart

```tsx
const { projection } = useGame();
if (!projection) return null;

// projection.percentiles.p5  → number[]
// projection.percentiles.p25 → number[]
// projection.percentiles.p50 → number[] (the median line)
// projection.percentiles.p75 → number[]
// projection.percentiles.p95 → number[]
// Each array is roughly (remainingTicks / 4) long — one point per month

const coneData = projection.percentiles.p50.map((median, i) => ({
  month: i,
  p5: projection.percentiles.p5[i],
  p25: projection.percentiles.p25[i],
  p50: median,
  p75: projection.percentiles.p75[i],
  p95: projection.percentiles.p95[i],
}));
```

### Handling the rebalance flow

```tsx
const { state, rebalance } = useGame();

// Local state for the rebalance editor
const [draftAllocations, setDraftAllocations] = useState(
  state.positions.map((p) => ({ assetId: p.assetId, pct: p.pct })),
);

// When user adjusts a slider, update draft
// When user clicks "Confirm Rebalance":
const handleConfirm = () => {
  const sum = draftAllocations.reduce((s, a) => s + a.pct, 0);
  if (sum !== 100) {
    alert("Allocations must sum to 100%");
    return;
  }
  rebalance(draftAllocations);
  closeRebalancePanel();
};
```

### Formatting helpers you'll want

```tsx
// CHF currency
const formatCHF = (n: number) =>
  new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);

// Percentage
const formatPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// Tick to "Year X, Week Y"
const formatTick = (tick: number) => `Year ${Math.floor(tick / 52) + 1}`;

// Duration
const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
```

---

## Things That Are NOT Your Problem

- Timer management (the engine hook handles setInterval, speed changes, pause/resume)
- Event scheduling (the engine decides when events fire based on the seed's crash data)
- Score calculation (happens automatically when the game ends)
- Social proof aggregation (the DB trigger updates stats on every insert)
- Benchmark calculation (computed at game start, never changes)
- Projection recalculation (the hook calls it every 4th tick and on rebalance/events)
- Session persistence (startGame creates it, completeGame updates it, all automatic)

---

## Things That ARE Your Problem

- Making the allocation sliders sum to 100% (validate before calling rebalance/startGame)
- Showing/hiding the event modal based on `phase === 'event'`
- Progressive chart rendering (only show data up to `state.currentTick`)
- Formatting numbers as CHF
- Responsive layout (this will be demoed on a projector AND on phones for voting)
- Loading states (seed data fetch takes 1-3s, show a spinner)
- The "Play Again" flow (simplest: just reload the page)
- Keyboard shortcuts (Space=play/pause, 1/3/5=speed) — add a useEffect with keydown listener

---

## Pages and Routes

Suggested structure:

```
app/
  page.tsx              ← Landing / game page (the phase router)
  leaderboard/
    page.tsx            ← Standalone leaderboard page
  layout.tsx            ← Wraps in GameProvider
```

Or if you want separate URL routes per screen:

```
app/
  page.tsx              ← Landing with "Start" button
  play/
    page.tsx            ← Onboarding + portfolio + simulation + results (all phase-driven)
    layout.tsx          ← GameProvider wrapper
  leaderboard/
    page.tsx            ← Standalone
```

Either works. For a hackathon, keeping everything on one page with phase-based rendering is simpler — no route transitions to manage, no state loss on navigation.

---

## Quick Start Checklist

1. Make sure `GameProvider` wraps your game page
2. Build the onboarding form → calls `createPlayer()` and `fetchSeedData()`
3. Build the portfolio builder → collects allocations, calls `startGame()`
4. Build the simulation screen → reads from `useGame()`, shows charts + controls
5. Build the event modal → shows when `phase === 'event'`, calls `chooseEventOption()`
6. Build the results screen → shows when `phase === 'results'`, displays final data
7. Build the leaderboard → reads from `useLeaderboard()`
8. Add keyboard shortcuts
9. Test the full flow end to end
