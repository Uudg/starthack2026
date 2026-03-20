# Frontend Guide: PvP Battle Mode

Addendum to the main frontend integration guide. This covers the 1v1 Battle Mode with shared timeline.

---

## What's Already Built

- `app/api/battle/rooms/...` — 8 API routes handling the full room lifecycle
- `lib/hooks/useBattleRoom.ts` — client hook with Realtime subscriptions for room state, players, events
- `lib/engine/simulation.ts` — new `advanceToTick()` function for externally-driven tick advancement
- `battle_rooms`, `battle_players`, `battle_event_choices` tables in Supabase with Realtime enabled
- Server-side tick broadcaster that advances the shared clock

---

## How Battle Mode Differs From Sandbox

In sandbox mode, the client runs its own timer (`setInterval`) and advances ticks locally. In battle mode:

- The **server** owns the clock. It writes `current_tick` to `battle_rooms` every ~270ms (at 3x speed).
- Both clients receive tick updates via **Supabase Realtime** (Postgres Changes).
- On each tick update, the client calls `advanceToTick()` to catch up its local engine state.
- Life events are triggered by the **server** (not the client engine's scheduler). When `room.active_event_key` changes from null to an event key, both clients show the event modal.
- **No pause button.** The clock is shared — nobody can pause individually.
- **No speed control.** Speed is set by the room creator during lobby setup.
- Rebalancing happens **while the clock ticks** — no auto-pause.

Everything else is the same: portfolio math, returns calculation, projection cone, scoring, coach popups.

---

## The Battle Hook

```tsx
const {
  // Room state
  room, // BattleRoom object (updates in real-time via Supabase)
  players, // BattlePlayer[] (both players, live updates)
  myPlayer, // your BattlePlayer row
  opponent, // opponent's BattlePlayer row

  // Status helpers
  isCreator, // true if you created the room
  bothReady, // true when both players clicked Ready
  bothFinished, // true when both players completed the simulation
  isInEventWindow, // true when a life event is active (decision window open)
  eventSecondsLeft, // countdown: 10, 9, 8...

  // Live event choices
  myEventChoice, // 'a' | 'b' | null during event window
  opponentEventChoice, // 'a' | 'b' | null (null until they choose or window ends)

  // Actions
  createRoom, // (config) => Promise<string> — returns room code
  joinRoom, // (code, playerId) => Promise<void>
  setReady, // (playerId, allocations) => Promise<void>
  startGame, // (playerId) => Promise<void> — only room creator calls this
  submitEventChoice, // (playerId, eventKey, chosen) => Promise<void>
  reportPortfolio, // (playerId, portfolio) => Promise<void>
  reportFinished, // (playerId, results) => Promise<void>

  // Meta
  loading,
  error,
} = useBattleRoom();
```

---

## Battle Flow: Screen by Screen

### Screen 1: Mode Selection

Before anything, the player picks Sandbox or Battle. This is a simple fork on your main page:

```tsx
// Not part of any hook — just local UI state
const [mode, setMode] = useState<"menu" | "sandbox" | "battle">("menu");

if (mode === "menu") return <ModeSelection onPick={setMode} />;
if (mode === "sandbox") return <SandboxGame />;
if (mode === "battle") return <BattleGame />;
```

The battle flow has its own phase system, separate from the sandbox `useGame()` phases.

### Screen 2: Battle Lobby — Create or Join

Two paths: Create a room or join with a code.

**Creating a room:**

```tsx
const { createRoom } = useBattleRoom();
const { player } = usePlayer();

const handleCreate = async () => {
  const code = await createRoom({
    playerId: player.id,
    seedId: "alpine-storm", // or let them pick
    startingPortfolio: 10000,
    monthlyContribution: 200,
    tickSpeed: 3,
  });
  // code is now something like 'A3F7'
  // Show it on screen + QR code
};
```

**Displaying the room code + QR:**

```tsx
import { QRCodeSVG } from "qrcode.react";

// After room is created:
<div>
  <h2>Room Code: {room.id}</h2>
  <QRCodeSVG value={`${window.location.origin}/battle/${room.id}`} size={200} />
  <p>Share this code or scan to join</p>
</div>;
```

**Joining a room:**

```tsx
const { joinRoom } = useBattleRoom();

const handleJoin = async () => {
  await joinRoom(codeInput.toUpperCase(), player.id);
};
```

**What you see in the lobby after both join:**

```tsx
const { room, players, opponent, myPlayer, bothReady, isCreator } =
  useBattleRoom();

// room.status === 'waiting'
// players.length === 2 (both connected)
// Show both players:
//   🐻 PlayerOne — [Ready ✓] or [Setting allocation...]
//   🦊 PlayerTwo — [Ready ✓] or [Setting allocation...]
```

The lobby updates in real-time. When the opponent joins, their row appears via the Realtime subscription — no polling needed. You'll see `players` go from length 1 to length 2 instantly.

### Screen 3: Battle Lobby — Allocation + Ready

Each player sets their allocation privately (same UI as the sandbox portfolio builder). When done:

```tsx
const { setReady } = useBattleRoom();

const handleReady = async () => {
  await setReady(player.id, [
    { assetId: "smi", pct: 40 },
    { assetId: "ch_bond", pct: 30 },
    { assetId: "gold_chf", pct: 20 },
    { assetId: "cash", pct: 10 },
  ]);
};
```

**You don't see the opponent's allocation.** Their `is_ready` status updates in real-time (via `myPlayer.is_ready` and `opponent.is_ready`), but their `allocations` field is only used server-side. Show it as:

```
🐻 You — Ready ✓
🦊 Opponent — Setting allocation...
```

Then when both ready:

```
🐻 You — Ready ✓
🦊 Opponent — Ready ✓

[Starting in 3... 2... 1...]
```

**The countdown:** When `bothReady` becomes true, the room status changes to `'countdown'` and `room.countdown_start` is set. Derive the countdown client-side:

```tsx
const [countdown, setCountdown] = useState<number | null>(null);

useEffect(() => {
  if (room?.status !== "countdown" || !room.countdown_start) return;

  const interval = setInterval(() => {
    const elapsed =
      (Date.now() - new Date(room.countdown_start!).getTime()) / 1000;
    const remaining = Math.max(0, 3 - Math.floor(elapsed));
    setCountdown(remaining);

    if (remaining <= 0) {
      clearInterval(interval);
      // Room creator triggers the start
      if (isCreator) {
        startGame(player.id);
      }
    }
  }, 100);

  return () => clearInterval(interval);
}, [room?.status, room?.countdown_start]);
```

Display the countdown as big numbers: **3... 2... 1... GO!**

Only the room creator calls `startGame()`. The other player just waits — the Realtime subscription will deliver `room.status = 'playing'` and ticks will start flowing.

### Screen 4: Battle Simulation

This is the main game screen, very similar to sandbox but with key differences.

**Initializing the local engine:**

When `room.status` changes to `'playing'`, initialize the game engine with the room's config:

```tsx
const { startGame: initEngine } = useGame();
const { seedData } = useSeedData();
const { room, myPlayer } = useBattleRoom();

useEffect(() => {
  if (room?.status === "playing" && seedData && myPlayer?.allocations) {
    initEngine({
      playerId: player.id,
      seed: seedData.seed,
      assets: seedData.assets,
      prices: seedData.prices,
      startingPortfolio: room.starting_portfolio,
      monthlyContribution: room.monthly_contribution,
      allocations: myPlayer.allocations,
    });
    // DON'T call engine.play() — the battle tick drives the engine
  }
}, [room?.status]);
```

**Driving the engine from server ticks:**

The core integration. Instead of the engine's own timer, you react to `room.current_tick`:

```tsx
import { advanceToTick } from "@/lib/engine/simulation";

const { state } = useGame(); // local engine state
const { room } = useBattleRoom();

useEffect(() => {
  if (!state || !room || room.status !== "playing") return;
  if (room.current_tick <= state.currentTick) return; // already caught up

  // Advance local engine to match server tick
  // Use advanceToTick() from the engine — runs ticks synchronously
  const { state: newState } = advanceToTick(
    state,
    room.current_tick,
    seedData.seed,
  );
  // Update the engine state via whatever setter is available
  // This depends on how useGameEngine exposes state updates
}, [room?.current_tick]);
```

**Important:** The existing `useGameEngine` hook may need a small addition — a `setState` or `setExternalState` method that lets the battle mode push state in from outside. Currently the hook manages its own state internally. The simplest approach: add an `overrideState(newState: SimulationState)` method to the hook that just calls the internal `setState`. Ask Copilot to add this when generating the engine hook.

Alternatively, for battle mode you might bypass `useGameEngine` entirely and manage state directly:

```tsx
const [battleState, setBattleState] = useState<SimulationState | null>(null);

useEffect(() => {
  if (!battleState || !room || room.current_tick <= battleState.currentTick)
    return;

  const { state: newState } = advanceToTick(
    battleState,
    room.current_tick,
    seedData.seed,
  );
  setBattleState(newState);
}, [room?.current_tick]);
```

This is simpler for battle mode — you use the engine functions directly without the hook's timer management, which you don't need.

**Reporting portfolio periodically:**

```tsx
const { reportPortfolio } = useBattleRoom();

useEffect(() => {
  if (!battleState || !room) return;
  if (room.current_tick % 30 === 0 && room.current_tick > 0) {
    reportPortfolio(player.id, battleState.totalPortfolio);
  }
}, [room?.current_tick]);
```

This updates `opponent.current_portfolio` for the live ticker.

**Displaying the opponent's live portfolio:**

```tsx
const { opponent } = useBattleRoom()

// Show somewhere on the simulation screen:
<div>
  Opponent: {opponent?.avatar} {opponent?.nickname} — CHF {opponent?.current_portfolio?.toFixed(0) ?? '...'}
</div>
```

This updates every ~30 ticks (~8 seconds at 3x speed). It's intentionally low-frequency — you get a rough sense of how the opponent is doing without full real-time visibility. The suspense is the point.

**Rebalancing during battle:**

Same as sandbox — the player can adjust sliders and confirm. But there's no pause. The ticks keep flowing while they're adjusting. Use the engine's `handleRebalance()` directly:

```tsx
import { handleRebalance } from "@/lib/engine/simulation";

const confirmRebalance = () => {
  const newState = handleRebalance(battleState, newAllocations);
  setBattleState(newState);
};
```

**The chart and stats** read from `battleState` exactly like sandbox reads from `state`. Same data shape, same formatting, same components.

### Life Event Modal (Battle Version)

**When to show:** When `room.active_event_key` is not null.

This replaces the sandbox event flow entirely. In battle mode, the server controls when events fire, not the client engine.

```tsx
const {
  room,
  eventSecondsLeft,
  myEventChoice,
  opponentEventChoice,
  submitEventChoice,
} = useBattleRoom();

const isEventActive = room?.active_event_key != null;
```

**What you show:**

```
┌─────────────────────────────────────────────────────┐
│  📰  Markets in Freefall                   ⏱️ 7s    │
│                                                      │
│  Breaking news: markets have crashed...              │
│                                                      │
│  Your portfolio: CHF 8,200                           │
│                                                      │
│  ┌────────────────────────────────┐                  │
│  │  A) Sell everything to cash    │                  │
│  │  68% of all players chose this │  ← global proof  │
│  └────────────────────────────────┘                  │
│  ┌────────────────────────────────┐                  │
│  │  B) Stay the course            │                  │
│  │  32% of all players chose this │                  │
│  └────────────────────────────────┘                  │
│                                                      │
│  🦊 Opponent: deciding...          ← or "decided ✓" │
└─────────────────────────────────────────────────────┘
```

**The countdown timer** (`eventSecondsLeft`) ticks down from 10 to 0. If the player doesn't choose in time, they get the default (Option B / no change). Handle this client-side:

```tsx
useEffect(() => {
  if (eventSecondsLeft === 0 && isEventActive && !myEventChoice) {
    // Auto-submit default choice
    handleChoice("b");
  }
}, [eventSecondsLeft]);
```

**Submitting a choice:**

```tsx
const handleChoice = async (chosen: "a" | "b") => {
  // 1. Submit to server (for sync + social proof)
  await submitEventChoice(player.id, room.active_event_key, chosen);

  // 2. Apply effect locally to engine state
  const newState = applyEventEffect(battleState, room.active_event_key, chosen);
  setBattleState(newState);
};
```

**Opponent's choice indicator:**

While the event window is open:

- `opponentEventChoice === null` → show "🦊 Opponent: deciding..."
- `opponentEventChoice === 'a' | 'b'` → show "🦊 Opponent: decided ✓"

You do NOT reveal _what_ they chose yet. Just that they've decided.

**After the event window closes** (`room.active_event_key` goes back to null):

Show a brief reveal (2–3 seconds):

```
You chose: Stay the course
Opponent chose: Sell everything

Resuming in 2...
```

To get the opponent's actual choice after both have decided, read from the Realtime-updated `opponentEventChoice` value. It becomes available the moment they submit (since `battle_event_choices` has Realtime enabled).

**Global social proof** for the event options comes from the same endpoint as sandbox:

```tsx
const [globalStats, setGlobalStats] = useState(null);

useEffect(() => {
  if (room?.active_event_key) {
    fetch(`/api/event-stats/${encodeURIComponent(room.active_event_key)}`)
      .then((res) => res.json())
      .then(setGlobalStats);
  }
}, [room?.active_event_key]);
```

### Screen 5: Waiting for Opponent (if you finish first)

Both players play the same 520 ticks, so they finish at the same server tick. But one player might have their final calculations done slightly before the other. When the last tick fires:

```tsx
const { reportFinished, bothFinished, opponent } = useBattleRoom()

useEffect(() => {
  if (room?.status === 'finished' && battleState && !myPlayer?.finished) {
    // Calculate final results
    const score = calculateCompositeScore(...)
    const profile = detectBehavioralProfile(...)

    reportFinished(player.id, {
      finalPortfolio: battleState.totalPortfolio,
      compositeScore: score,
      behavioralProfile: profile,
      snapshots: [...],
    })
  }
}, [room?.status])
```

If `bothFinished` is false, show:

```
Your simulation is complete!

Final portfolio: CHF 18,500

Waiting for opponent to finish...
🦊 Opponent: calculating results...
```

When `bothFinished` becomes true (via Realtime), transition to the results screen.

### Screen 6: Battle Results (Head-to-Head)

When both players have finished, you have everything needed for the comparison.

**Data available:**

```tsx
const { myPlayer, opponent, room } = useBattleRoom();
const { seedData } = useSeedData();

// Your results:
myPlayer.final_portfolio; // CHF 18,500
myPlayer.composite_score; // 72.3
myPlayer.behavioral_profile; // 'diamond_hands'
myPlayer.rank; // 1 or 2

// Opponent's results:
opponent.final_portfolio; // CHF 14,200
opponent.composite_score; // 58.1
opponent.behavioral_profile; // 'panic_seller'
opponent.rank; // 1 or 2

// The seed reveal:
seedData.seed.reveal_title; // "You invested through 2006–2016"
seedData.seed.reveal_text; // "You experienced the worst financial crisis..."

// Room context:
room.seed_id; // which scenario
room.game_start; // when it started
room.game_end; // when it ended
```

**Suggested layout:**

```
┌──────────────────────────────────────────────────────┐
│                    🏆 WINNER 🏆                       │
│                                                       │
│  🐻 PlayerOne          vs.         🦊 PlayerTwo      │
│  Diamond Hands 💎               Panic Seller 🔴      │
│                                                       │
│  CHF 18,500                      CHF 14,200          │
│  Score: 72.3                     Score: 58.1          │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  PORTFOLIO OVER TIME (overlay chart)                  │
│  ──── Your portfolio                                  │
│  ─ ─ ─ Opponent's portfolio                           │
│  · · · Benchmark (do nothing)                         │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  KEY DECISIONS                                        │
│                                                       │
│  📰 Market Crash (Year 3):                            │
│     You: Stayed the course                            │
│     Opponent: Sold everything                         │
│                                                       │
│  💼 Career Opportunity (Year 2):                      │
│     You: Took the job                                 │
│     Opponent: Stayed put                              │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  📜 Historical Reveal                                 │
│  "You invested through 2006–2016"                     │
│  "You experienced the worst financial crisis..."      │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Play Again]    [Sandbox Mode]    [Leaderboard]      │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**The overlay chart** is the strongest visual. Both players' portfolio values over time on one chart. To build this, you'd need both players' tick-by-tick values. You already have your own from `battleState`. For the opponent's curve, there are two options:

Option A (simple): Skip the overlay chart. Just show final numbers side-by-side. The event choice comparison alone is dramatic enough for a demo.

Option B (better for demo): Store your own tick-by-tick portfolio values in a local array during the simulation, and have the opponent do the same. After both finish, exchange the arrays via Supabase (store them as JSONB on `battle_players`, or fetch the opponent's portfolio snapshots). This is a post-game fetch, not real-time.

```tsx
// During simulation, build the history locally:
const portfolioHistory = useRef<number[]>([]);

useEffect(() => {
  if (battleState) {
    portfolioHistory.current[battleState.currentTick] =
      battleState.totalPortfolio;
  }
}, [battleState?.currentTick]);

// After game, report it with results:
reportFinished(player.id, {
  ...results,
  portfolioHistory: portfolioHistory.current, // add to the results payload
});
```

The API and DB would need a small addition to store/return this array. For the hackathon, you could also just store it client-side and only show your own curve + the opponent's key moments (event choices).

**Comparing event choices:**

The `battle_event_choices` table has all choices for both players. Fetch them at results time:

```tsx
// These are already tracked via Realtime during the game,
// but you can also fetch all at once for the results screen:
const choices = await supabase
  .from("battle_event_choices")
  .select("*")
  .eq("room_id", room.id)
  .order("chose_at");

// Group by event_key:
const byEvent = {};
choices.forEach((c) => {
  if (!byEvent[c.event_key]) byEvent[c.event_key] = {};
  byEvent[c.event_key][c.player_id] = c.chosen;
});

// Now render:
// "Market Crash: You stayed, Opponent sold"
// "Career Opportunity: You took the job, Opponent stayed"
```

---

## The Coach in Battle Mode

The AI coach works the same way — it auto-triggers on game_start, events, panic rebalances, and game_end. In battle mode, the `game_end` coach message can reference the opponent:

The coach prompt context already includes portfolio values and behavioral data. For battle mode, you could extend it to include the matchup result, but this isn't required for the hackathon — the coach commenting on the player's own performance is enough.

---

## Battle Mode Routing

Suggested URL structure:

```
/battle              → mode selection (create or join)
/battle/[code]       → lobby + game + results for a specific room
```

The `/battle/[code]` page handles the full lifecycle based on `room.status`:

```tsx
export default function BattlePage({ params }: { params: { code: string } }) {
  const { room, players, ... } = useBattleRoom()

  // On mount, try to fetch/join the room
  useEffect(() => {
    if (params.code) {
      // If not already in the room, show join prompt
      // If already in the room, reconnect via Realtime
    }
  }, [params.code])

  if (!room) return <JoinPrompt code={params.code} />

  switch (room.status) {
    case 'waiting':
      return <BattleLobby />
    case 'countdown':
      return <CountdownScreen />
    case 'playing':
      return <BattleSimulation />
    case 'finished':
      return <BattleResults />
  }
}
```

This means the QR code URL (`/battle/A3F7`) takes the opponent directly to the right page. They see the lobby, set their allocation, click ready, and they're in.

---

## Reconnection

If a player refreshes mid-game, the Realtime subscription re-establishes automatically when `useBattleRoom` mounts. The room state is in Supabase, so the client reads `room.current_tick` and catches up by calling `advanceToTick()` from tick 0 to the current tick. This takes milliseconds (it's just math in a loop, no I/O).

The player's portfolio state is fully reconstructible from:

1. Their starting allocation (stored in `battle_players.allocations`)
2. The price data (already fetched from seeds)
3. Their event choices (stored in `battle_event_choices`)
4. The current tick (from `room.current_tick`)

So even a full page refresh mid-game recovers cleanly. Build the replay logic:

```tsx
function replayToCurrentTick(
  allocations: AllocationEntry[],
  prices: Record<string, number[]>,
  currentTick: number,
  eventChoices: BattleEventChoice[],
  seed: Seed,
  config: { startingPortfolio: number; monthlyContribution: number }
): SimulationState {
  // 1. Init simulation with original allocations
  let state = initSimulation({ ...config, allocations, seed, assets: ..., prices })

  // 2. Advance tick by tick, applying event choices at the right ticks
  for (let tick = 1; tick <= currentTick; tick++) {
    const { state: newState } = tickSimulation(state, seed)
    state = newState

    // Check if there's an event choice for this tick
    // (The battle events fire at fixed ticks — match against the schedule)
    const eventAtTick = getEventForTick(tick, seed)
    if (eventAtTick) {
      const choice = eventChoices.find(c => c.event_key === eventAtTick)
      if (choice) {
        state = applyEventEffect(state, eventAtTick, choice.chosen)
      }
    }
  }

  return state
}
```

This ensures the player is back in sync after any disconnection.

---

## Checklist

1. Add mode selection (Sandbox vs Battle) to your main page
2. Build the lobby screen: create room, show code + QR, join room
3. Build the allocation + ready flow in the lobby
4. Build the countdown overlay (3-2-1-GO)
5. Wire the battle simulation screen: listen to `room.current_tick`, drive engine with `advanceToTick()`
6. Build the battle event modal with countdown timer + opponent status ("deciding..." / "decided ✓")
7. Add the opponent portfolio ticker somewhere on the simulation screen
8. Build the results comparison screen: head-to-head stats, event choice comparison, winner banner
9. Handle reconnection (replay to current tick on page refresh)
10. Add `qrcode.react` for the lobby QR code: `yarn add qrcode.react`

---

## Things That Are NOT Your Problem

- Tick broadcasting (server handles it)
- Event timing (server decides when events fire)
- Opponent state sync (Supabase Realtime handles it)
- Score calculation (same engine functions as sandbox)
- Choice storage and social proof aggregation (API + DB triggers)

## Things That ARE Your Problem

- Driving the local engine from `room.current_tick` instead of the internal timer
- The 10-second event countdown + auto-submit default if they don't choose
- Hiding opponent's specific choice until both have decided
- The replay/reconnection logic if a player refreshes
- Making the QR code visible and scannable on a projector (make it big, high contrast)
- The head-to-head results layout — this is the demo moment, make it dramatic
