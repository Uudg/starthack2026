## Game Overview

This project is a browser-based, pixel-art trading game where the player:
- Picks a character with a distinct persona.
- Chooses which markets to trade (stocks, FX, crypto).
- Allocates a portfolio via a retro trading terminal.
- Timeskips through a scripted market path (growth → crash → recovery).
- Receives a score, AI opponent comparison, and educational “lessons learned” at the end.

The game is built with TypeScript and DOM-driven UI (no React); it uses custom pixel UI components, WebAudio for sound, and a small rendering layer for pixel art, particles, and sprites.

---

## High-Level Architecture

- **Entry point (`src/main.ts`)**
  - Bootstraps the `GameStore`, `AudioEngine`, and core engines.
  - Mounts the current “screen” (e.g. character select, market select, trading, timeskip, results) into a root DOM container.
  - Registers engines on `window.__gameEngines` so screens can coordinate with `MarketEngine`, `ScoringEngine`, and `AIOpponents`.

- **State management (`src/state/GameStore.ts`)**
  - Central, mutable store that holds `GameState` and dispatches `GameAction`s.
  - Simple subscribe/notify mechanism keyed by property name or `'*'`.
  - Core responsibilities:
    - Screen routing via `currentScreen` (e.g. `'character-select'`, `'market-select'`, `'trading'`, `'timeskip'`, `'results'`).
    - Player identity: `selectedCharacter`, `characterAnimation`.
    - Market configuration: `selectedCategories`, `allocations`, `pricePaths`, `benchmarkPath`.
    - Simulation progress: `currentRound`, `totalRounds`, `currentMonth`, `currentPhase`, `simulationSpeed`, `isSimulating`.
    - Presentation context: `season`, `timeOfDay`, `isMuted`.
    - Outcomes and meta: `portfolioValue`, `currentCash`, `portfolioHistory`, `eventChoices`, `aiOpponents`, `score`.
  - Important actions:
    - `SELECT_CHARACTER`, `SELECT_CATEGORIES`, `SET_ALLOCATION`.
    - `CONFIRM_TIMESKIP`, `ADVANCE_ROUND`, `UPDATE_PRICES`.
    - `FINISH_GAME`, `RESTART_GAME`, `SET_SCREEN`, `SET_ANIMATION`, `SET_SIMULATION_SPEED`, `TOGGLE_MUTE`.

- **Engines (`src/engine`)**
  - **`MarketEngine`**
    - Generates deterministic price paths for all assets across rounds (growth, crash, recovery).
    - Exposes helpers like `generateAllPaths()` and `calculatePortfolioValue(month)` for screens.
    - Uses constants from `src/constants/market.ts` and `src/constants/assets.ts`.
  - **`ScoringEngine`**
    - Turns the final state of the portfolio into a `ScoreBreakdown`:
      - `diversification`, `riskAlignment`, `crashBehaviour`, `returnVsBenchmark`, and overall `total` and `verdict`.
    - Used by `ResultsScreen` to compute the player’s final score.
  - **`AIOpponents`**
    - Simulates a set of AI traders with different behaviours.
    - Uses the same market paths to generate opponent scores, stored in `state.aiOpponents` for podium display.

- **Rendering & sprites (`src/rendering`, `src/sprites`, `src/animations`)**
  - **`PixelRenderer` / `SpriteSheet` / `Animator`**
    - Low-level utilities for pixel-perfect drawing into `<canvas>` and animating sprite frames.
  - **`ParticleSystem`**
    - Emits different particle types (`'coins'`, `'crash'`, `'confetti'`, `'rain'`, `'steam'`) with simple physics.
    - Used primarily on the results screen to visualize good/bad outcomes (coins vs rain).
  - **Sprites (`src/sprites/...`)**
    - Character sprites (Analyst, Hustler, Retiree, Student) and environment sprites (room, terminal screen, window scenes, opponents).
    - Export `SPRITE_FRAMES` which are consumed by `CharacterPixiView` and room/environment renderers.
  - **Animations (`src/animations/...`)**
    - `RoomAnimations`, `TimeskipAnimation`, `ScreenTransition` and others orchestrate small, focused animation sequences.

- **Audio (`src/audio`)**
  - **`AudioEngine`**
    - Wrapper around `AudioContext` with lazy initialization and resume logic.
    - Core primitives:
      - `playTone`, `playSweep` for retro beeps and sweeps.
      - `playNoise` for static-like SFX.
      - `playArpeggio` for level-up / victory sounds.
    - Respects mute state (`store.getState().isMuted`).
  - **`SoundEffects`**
    - Semantic, game-level sounds built on top of `AudioEngine` (e.g. `buttonPress`, `tabClick`, `timeskipWhoosh`, `levelUpArpeggio`).

- **UI components (`src/components`)**
  - **Trading components (`src/components/trading`)**
    - `StocksPanel`, `FXPanel`, `CryptoPanel`:
      - Render lists of tradable assets for each category.
      - Allow the player to adjust long/short percentage allocations.
      - Surface current prices and changes from `GameStore.pricePaths`.
    - `PortfolioSummary`:
      - Shows total portfolio value, return vs starting cash, current cash, and allocation breakdown by category (stocks / FX / crypto / cash).
  - **Charts (`src/components/charts`)**
    - `PortfolioLineChart`:
      - Shows the portfolio vs benchmark price over months.
      - Driven by `TradingScreen`’s `updatePortfolioChart()` using both `benchmarkPath` and `MarketEngine`’s portfolio value calculations.
    - `CandlestickChart`, `ScoreBarChart`, `AllocationDonut`:
      - Additional visualizations for market moves, scores, and allocation splits.
  - **Results components (`src/components/results`)**
    - `ScoreDisplay`: animates the final numeric score and verdict text.
    - `LessonChest`: clickable “lesson” cards that reveal educational content based on the player’s run.
    - `Podium`: ranks the player against AI opponents with a podium visual.
  - **UI primitives (`src/components/ui`)**
    - `PixelButton`: retro-styled button with variants and disabled state.
    - `PixelTabs`: tabbed navigation with active state and callbacks.
    - `PixelCard`, `PixelTooltip`, `PixelStatBar`, `PixelSlider`, `NewsTicker`: building blocks for consistent pixel-art UI.

- **Constants & types (`src/constants`, `src/types`)**
  - `constants/assets.ts`: defines stock, FX, and crypto assets (tickers, labels, categories).
  - `constants/market.ts`: simulation parameters such as `STARTING_CASH`, volatility, round lengths, and benchmark setup.
  - `constants/characters.ts`: character metadata (id, title, flavour text, risk persona).
  - `types/*.ts`: shared domain types like `GameState`, `GameAction`, `ScreenID`, `MarketCategory`, `AssetAllocation`, `ScoreBreakdown`, `CharacterID`, `AnimationState`, etc.

---

## Core Gameplay Flow (Screens)

### 1. Character select
- Screen: `CharacterSelectScreen` (not shown above, but referenced via `currentScreen`).
- Flow:
  - Player picks a persona (Analyst, Hustler, Retiree, Student).
  - `GameStore.dispatch({ type: 'SELECT_CHARACTER', ... })`.
  - Transitions to `'market-select'` via `SET_SCREEN`.

### 2. Market select (`MarketSelectScreen`)
- File: `src/screens/MarketSelectScreen.ts`.
- Responsibilities:
  - Render a browser-like UI (`market-browser`) with three tiles:
    - Stocks, FX, Crypto, each showing tickers from `STOCK_ASSETS`, `FX_ASSETS`, and `CRYPTO_ASSETS`.
  - Track selected categories in a local `Set<MarketCategory>` and mirror them into `GameStore` on confirm.
  - Instantiate `CharacterPixiView` using the chosen `CharacterID` and sprite frames to show the avatar.
  - Provide contextual speech bubble:
    - 1 category → “That’s risky... but I’ll allow it.”
    - ≥ 2 categories → “Good diversification!”
  - Confirm button (`PixelButton "LET'S TRADE"`):
    - Disabled until at least one category is selected.
    - On click:
      - Dispatches `SELECT_CATEGORIES`.
      - Calls `window.__gameEngines.marketEngine.generateAllPaths()` to prepare simulation data.
      - Routes to `'trading'` via `SET_SCREEN`.

### 3. Trading (`TradingScreen`)
- File: `src/screens/TradingScreen.ts`.
- Visual structure:
  - **Left side**: background video scene representing the trader’s room.
    - Intro video (`beginning.mp4`) plays once, then swaps to a loop video.
    - Phase label (year/round) driven by `state.currentRound`.
    - Season label driven by `state.season`.
    - Optional `SKIP INTRO` button that immediately:
      - Stops intro, starts loop.
      - Reveals the trading terminal.
  - **Right side**: draggable trading terminal.
    - Header with title (`▶ TRADING TERMINAL`) and round name.
    - `PixelTabs` for active markets (`stocks`, `fx`, `crypto`) and a `portfolio` tab.
    - Panel area that holds:
      - `StocksPanel`, `FXPanel`, `CryptoPanel` as configured by `selectedCategories`.
      - `PortfolioLineChart` under the `portfolio` tab.
    - Summary area: `PortfolioSummary`.
    - Bottom: `NewsTicker` and a big `INVEST & SKIP TIME` button.

- Key logic:
  - **Tab and panel management**
    - Tracks `activeTab` and toggles `data-panel` containers’ display.
    - Panels receive current prices via `updatePanelPrices(category)` which derives from `state.pricePaths[state.currentMonth]`.
  - **Allocations**
    - Local `Map<string, { percentage; position }>` holds per-asset allocations as the player adjusts sliders.
    - `handleAllocationChange` callback updates the map and recomputes `PortfolioSummary`:
      - Sums allocation by asset, aggregates into category percentages.
      - Computes `cash` as `100 - allocated%` (clamped at 0).
  - **Portfolio summary & chart**
    - `updatePortfolioSummary()`:
      - Uses `state.portfolioValue` and `state.startingCash` to compute realized return percentage.
      - Reflects allocation distribution across stocks, FX, crypto, and cash.
    - `updatePortfolioChart()`:
      - Builds arrays for portfolio vs benchmark:
        - Benchmark from `state.benchmarkPath`.
        - Portfolio from `MarketEngine.calculatePortfolioValue(m)` for each month up to `currentMonth`.
  - **Timeskip**
    - On `INVEST & SKIP TIME` click:
      - Dispatches `SET_ALLOCATION` with the current allocation map.
      - Looks up `MarketEngine` via `window.__gameEngines`.
      - Uses a predefined `monthRanges` per round to pick a target month.
      - Computes portfolio value at that month, updates `GameStore`:
        - `portfolioValue`, `currentMonth`.
      - Dispatches:
        - `CONFIRM_TIMESKIP` (sets `isSimulating = true`).
        - `SET_SCREEN` to `'timeskip'`.

### 4. Timeskip (`TimeskipScreen`)
- Shows a transition animation representing time passing and markets evolving.
- On completion:
  - Either:
    - Advances to the next `currentRound` (`ADVANCE_ROUND`) and returns to `TradingScreen`, or
    - Ends the game and routes to `'results'` (`FINISH_GAME`).

### 5. Results (`ResultsScreen`)
- File: `src/screens/ResultsScreen.ts`.
- Sequence on mount:
  - Fetch engines from `window.__gameEngines`:
    - `scoringEngine.calculateScore()` → `ScoreBreakdown`.
    - `aiOpponents.generateOpponents()` → fills `state.aiOpponents`.
  - Fallback: if engines aren’t available, use a default `ScoreBreakdown`.
  - Persist score to `GameStore` via `setState({ score })`.

- Layout:
  - **Top: room scene + character + particles**
    - `RoomScene` draws the environment into a `<canvas>` using:
      - `season`, `timeOfDay`, and an abstract “portfolio health”.
    - `CharacterPixiView` renders the player avatar:
      - Animation state based on final score:
        - ≥ 70 → `'celebrating'`
        - 40–69 → `'idle'`
        - < 40 → `'defeated'`
    - `ParticleSystem` emits:
      - `'coins'` bursts for high scores.
      - `'rain'` streaks for poor scores.
    - An internal animation loop re-draws the scene and particles each frame and tracks frame IDs for cleanup.
  - **Top-right: score breakdown**
    - `ScoreDisplay`:
      - Shows total score and verdict.
      - Animates up to the final score after a short delay; triggers a level-up arpeggio SFX for strong runs.
    - `PixelStatBar`s (`buildScoreBars()`):
      - One bar per category:
        - Diversification (max 25)
        - Risk alignment (max 25)
        - Crash behaviour (max 30)
        - Return vs benchmark (max 20)
  - **Middle: “Lessons learned”**
    - `buildLessonChests()` creates three `LessonChest` components:
      - **YOUR DRAWDOWN**:
        - Calculates worst drawdown and recovery based on `portfolioValue` vs `startingCash`.
        - Explains the concept of drawdown and recovery in plain language.
      - **DIVERSIFICATION**:
        - Highlights the best vs worst allocation choices from `state.allocations`.
        - Explains diversification as risk spreading.
      - **TIME IN MARKET**:
        - Compares staying invested vs selling at the crash bottom.
        - Quantifies the CHF difference for the player’s run.
  - **Bottom: podium & restart**
    - `Podium`:
      - Combines player result (with display name from `CHARACTERS`) and `state.aiOpponents`.
      - Ensures at least 4 entries for a full podium look.
    - `PLAY AGAIN` button:
      - Dispatches `RESTART_GAME`, which resets `GameStore` to `createInitialState()` and returns to the starting screen.

---

## Visual & UX Systems

- **CSS & styles**
  - `trading.css`, `market-select.css`, `results.css`, etc., define:
    - Retro scanline overlays.
    - Pixelated fonts and borders.
    - Responsive layout for side-by-side room and terminal.
  - Classes like `scanlines`, `terminal-monitor`, `terminal-bezel`, and `market-browser` create the core aesthetic.

- **Interactivity & polish**
  - Hover states on market tiles (soft accent borders).
  - Draggable terminal window with clamped boundaries, using pointer events.
  - Intro video skip functionality for impatient players.
  - Context-dependent speech bubbles and SFX to reinforce decisions.

---

## How to Extend or Modify

- **Add a new market category**
  - Extend `MarketCategory` in `src/types/market.types.ts`.
  - Add assets in `constants/assets.ts`.
  - Update `CATEGORY_TILES` in `MarketSelectScreen`.
  - Adjust `TradingScreen.buildTerminal()` to add a new tab and panel.
  - Implement a new panel component in `src/components/trading`.
  - Update `MarketEngine` and price path generation for the new assets.

- **Add a new character**
  - Add metadata in `constants/characters.ts`.
  - Create sprite frames under `src/sprites/characters`.
  - Update the character-select screen and maps (`spriteMap` usages) to include the new `CharacterID`.

- **Adjust difficulty or pacing**
  - Tune `STARTING_CASH`, round lengths, and volatility in `constants/market.ts`.
  - Adjust scoring weights in `ScoringEngine`.
  - Modify `monthRanges` in `TradingScreen` to change how far each timeskip jumps.

---

## Mental Model Summary

- **Single source of truth**: `GameStore` owns all game state; screens are thin controllers that read from it and dispatch actions.
- **Engines encapsulate rules**: `MarketEngine`, `ScoringEngine`, and `AIOpponents` hold the “math” and game logic, decoupled from UI.
- **Screens drive flow**: `CharacterSelectScreen` → `MarketSelectScreen` → `TradingScreen` ↔ `TimeskipScreen` → `ResultsScreen`.
- **Rendering is layered**: DOM for UI and layout; `<canvas>` plus sprite/particle helpers for pixel art and feel.
- **Education baked into results**: Scores, opponent comparisons, and lesson chests are all derived from the actual playthrough to teach real investing concepts.

