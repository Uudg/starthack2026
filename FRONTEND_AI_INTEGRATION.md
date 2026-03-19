# Frontend Guide: AI Investment Coach

Addendum to the main frontend integration guide. This covers the AI coach popup that streams educational commentary during gameplay.

---

## What's Already Built

The backend and hooks are done:

- `app/api/coach/route.ts` — streaming API route that calls Claude Haiku
- `lib/engine/coach-prompts.ts` — prompt templates for every trigger type
- `lib/hooks/useCoach.ts` — hook that manages streaming, state, auto-dismiss
- `lib/store/game-context.tsx` — auto-triggers the coach at the right moments

**You don't trigger the coach manually.** The game context watches for key moments (game start, crashes, life events, panic behavior) and fires the coach automatically. Your job is just to render the popup when there's a message.

---

## How to Access Coach Data

```tsx
const { coach } = useGame();

coach.currentMessage; // the active message, or null
coach.messageHistory; // all messages this session
coach.dismiss(); // manually close the popup
coach.isLoading; // true while waiting for first token from API
```

The `currentMessage` object:

```typescript
{
  id: string; // unique ID
  trigger: string; // what caused it: 'game_start', 'market_crash', 'panic_rebalance', etc.
  text: string; // the coach's text (grows character by character while streaming)
  isStreaming: boolean; // true while text is still arriving
  timestamp: number; // when it started
}
```

---

## The Popup Component

This is the only UI you need to build. It sits on top of every screen — simulation, events, results.

```tsx
function CoachPopup() {
  const { coach } = useGame();
  if (!coach.currentMessage) return null;

  return (
    <div className="...">
      {/* Coach avatar/icon */}
      <span>🧑‍🏫</span>

      {/* Streaming text */}
      <p>
        {coach.currentMessage.text}
        {coach.currentMessage.isStreaming && (
          <span className="animate-pulse">▊</span>
        )}
      </p>

      {/* Dismiss button */}
      <button onClick={coach.dismiss}>✕</button>
    </div>
  );
}
```

Place it in your layout or game page so it renders regardless of which screen is active:

```tsx
export default function GamePage() {
  const { phase } = useGame();

  return (
    <>
      <CoachPopup />
      {phase === "onboarding" && <OnboardingScreen />}
      {phase === "simulating" && <SimulationScreen />}
      {/* ... etc */}
    </>
  );
}
```

---

## When the Coach Fires (So You Know What to Expect)

You don't control these — they happen automatically. But you need to know what to expect so the popup doesn't clash with other UI.

| Trigger             | When                                        | Duration | What it says                                      |
| ------------------- | ------------------------------------------- | -------- | ------------------------------------------------- |
| `game_start`        | Simulation begins (phase → paused)          | 12s      | Encouraging kickoff, comments on their allocation |
| `life_event_before` | Life event modal appears                    | 12s      | Educational context about the decision type       |
| `life_event_after`  | Player makes event choice                   | 12s      | Reflection on their choice + social proof         |
| `market_crash`      | Historical crash event fires                | 12s      | Explains what's happening, why not to panic       |
| `market_recovery`   | Recovery event fires                        | 12s      | Celebrates patience, reinforces lesson            |
| `panic_rebalance`   | Player shifts to cash/bonds during drawdown | 12s      | Gently explains "selling low" concept             |
| `all_in_equity`     | Player goes 90%+ equities                   | 12s      | Mentions diversification benefits                 |
| `cash_heavy`        | Cash > 50% for ~7+ months                   | 12s      | Explains cash drag and inflation                  |
| `milestone`         | Portfolio triples from starting value       | 12s      | Celebrates compound growth                        |
| `game_end`          | Results screen appears                      | 30s      | Personalized summary of their whole journey       |

**Cooldown:** There's an 8-second minimum gap between messages (except `game_end` which always fires). If two triggers happen close together (crash news + life event), only the first one shows.

---

## Positioning and Z-Index

The coach popup should:

- Float in a corner (bottom-left or top-right — wherever it doesn't overlap the main chart)
- Be above the simulation screen but BELOW the life event modal
- Not block the play/pause or speed controls
- Not block the allocation sliders

Suggested z-index layering:

```
Simulation screen:    z-0
Coach popup:          z-30
Historical news bar:  z-20
Life event modal:     z-50 (coach popup hides behind this — that's fine)
```

When a life event modal is open, the coach message about the event will be visible _before_ the modal animates in (since `life_event_before` triggers at the same time as the modal). Once the modal covers the screen, the coach popup is hidden behind it — but the text is about the event anyway, so it's redundant. After the player chooses and the modal closes, the `life_event_after` coach message appears fresh.

---

## Handling the Streaming Text Effect

The text grows as tokens arrive. Typical behavior:

- First token arrives ~300ms after the popup appears
- Full message completes in ~1-2 seconds
- The blinking cursor (▊) shows while `isStreaming === true`

**Don't set a fixed height** on the popup. Let it grow with the text. The messages are always 2-3 sentences (the AI is prompted to stay short), so max height is predictable.

**Entry animation:** Fade in or slide in from the edge. Don't animate on every text update — just on initial appearance (`currentMessage` goes from `null` to an object).

**Exit animation:** Fade out when dismissed or auto-expired. The `currentMessage` goes back to `null` — use a transition or `AnimatePresence` (Framer Motion) to catch the exit.

---

## The `game_end` Message Is Special

When the game ends, the coach gives a personalized 2-3 sentence summary of the player's entire journey. This is the most meaningful coach message and should be prominent on the results screen.

Unlike other messages that appear as a floating toast, you might want to render the `game_end` message **inline on the results screen** — maybe as a highlighted card at the top, styled differently from the normal popup.

To detect it:

```tsx
const { coach } = useGame();

const isEndSummary = coach.currentMessage?.trigger === "game_end";
```

This auto-dismisses after 30 seconds (vs 12 for others), giving the player time to read it. But you can also keep it visible permanently on the results screen by checking `coach.messageHistory` for the `game_end` entry:

```tsx
const endMessage = coach.messageHistory.find((m) => m.trigger === "game_end");
```

---

## Message History (Optional Feature)

All coach messages from the session are stored in `coach.messageHistory`. You could optionally show these as a scrollable log — either as a sidebar panel on the simulation screen or as a section on the results screen.

This is a nice-to-have. Each entry has `trigger`, `text`, and `timestamp` so you can format it as a timeline:

```
🧑‍🏫 Year 1: "Welcome to your investment journey..."
🧑‍🏫 Year 3: "Markets just crashed 30%. This is what 2008 felt like..."
🧑‍🏫 Year 3: "You chose to stay the course. 32% of players did the same..."
🧑‍🏫 Year 7: "Your portfolio just tripled! Compound growth is powerful..."
🧑‍🏫 Final: "Over 10 years you stayed disciplined through two crashes..."
```

---

## Edge Cases

**Coach fails (API error or timeout):** The popup just doesn't appear. No error shown to the player — the game continues normally. Coach messages are strictly supplementary; they never block gameplay. Check the browser console for errors if you want to debug.

**Multiple rapid triggers:** The cooldown (8 seconds) prevents spam. If two triggers fire within 8 seconds, the second one is silently dropped. Exception: `game_end` always fires regardless of cooldown.

**Slow network:** The streaming approach means the first words appear quickly (~300ms) even if the full message takes 2 seconds. If the network is very slow, `isLoading` stays true and the popup appears empty with a loading indicator — then text starts flowing. If the request fails entirely, the popup auto-dismisses.

**Player dismisses before streaming completes:** `dismiss()` aborts the in-flight request (the hook calls `abortController.abort()`). Clean and immediate.

---

## Checklist

1. Build a `CoachPopup` component that reads `coach.currentMessage` and renders floating text
2. Place it in the game layout so it shows on all screens
3. Handle the streaming cursor (▊ while `isStreaming`)
4. Add entry/exit animations
5. Make sure it doesn't overlap critical controls (play/pause, allocation sliders)
6. On the results screen, consider rendering the `game_end` message inline instead of as a toast
7. Optionally: show message history as a timeline
