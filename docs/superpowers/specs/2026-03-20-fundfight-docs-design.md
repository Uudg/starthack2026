---
name: FundFight Documentation Design
description: Design spec for Fumadocs-based backend documentation site integrated into the FundFight Next.js app at /docs
type: project
date: 2026-03-20
---

# FundFight Documentation — Design Spec

## Purpose

Create a Fumadocs documentation site integrated into the existing FundFight Next.js app at `/docs`. The audience is PostFinance (the challenge partner and judges), including both technical evaluators and business stakeholders. The docs explain how the backend works — data processing, simulation logic, calculations — not the UI.

## Audience

- **Primary:** PostFinance challenge partner / hackathon judges
- **Technical evaluators:** need formulas, algorithms, architecture
- **Business stakeholders:** need conceptual explanations of what each system does and why

## Approach

**Narrative flow** — documentation follows the journey of a single game session from start to finish, covering each backend system as it becomes relevant. This tells a coherent story rather than presenting a dry modular reference.

## Structure

### 1. Overview
- What FundFight is, why it was built, what problem it solves for PostFinance
- System architecture diagram (engine → API → Supabase → AI coach)

### 2. Market Data & Scenarios
- How real historical price data (21 assets, ~20 years) is stored and served
- What a "seed" is — the 4 curated 10-year windows (easy/medium/hard)
- How weekly price rows are fetched for a session

### 3. The Simulation Engine
- The tick loop: 1 tick = 1 week, 520 ticks = 10 years, runs at up to 5× speed
- How weekly returns are calculated (`newValue = currentValue × priceNow / pricePrev`)
- Monthly contributions: applied every 4 ticks

### 4. Portfolio Management
- Rebalancing: redistributing allocation percentages across positions
- Panic sell detection: drawdown > 15% + shift to cash > 20 percentage points
- Benchmark: the "do nothing" baseline run alongside the player

### 5. Life Event System
- Life events and their A/B choices (no specific count mentioned)
- Event chaining (e.g., career opportunity → promotion or stagnation)
- How choices affect contribution amount and portfolio value

### 6. Monte Carlo Projections
- What the projection cone shows (p5–p95 percentiles)
- How 200 GBM simulations are run using realized volatility
- Probability of hitting savings target

### 7. Scoring & Behavioral Profiles
- Composite score formula: Portfolio 40%, Discipline 35%, Events 25%
- The 6 behavioral profiles (Diamond Hands, Panic Seller, Cash Hoarder, Overthinker, Strategist, Momentum Chaser)
- What each metric measures and why it matters educationally

### 8. AI Coach
- When and why the coach triggers (multiple trigger types)
- How prompts are constructed with live game context
- Streaming SSE delivery via Claude Haiku

### 9. API Reference
- All 9 endpoints with purpose, request, response
- Database schema overview (9 tables/views)

## Technical Approach

- **Fumadocs** integrated into existing Next.js app (`app/` workspace)
- MDX files for content under `app/content/docs/`
- Fumadocs UI for styling (dark theme, consistent with FundFight aesthetic)
- `/docs` route served by Fumadocs page handler
- Each section = one MDX file with: plain-language summary at top + technical depth (formulas, code snippets) below

## Content Tone

Each page follows a two-layer structure:
1. **Plain English summary** (2–4 sentences, readable by anyone)
2. **Technical detail** (formulas, algorithms, data structures — for evaluators)

## Files to Create

```
app/
  content/
    docs/
      index.mdx                    # Overview
      market-data.mdx              # Market Data & Scenarios
      simulation-engine.mdx        # The Simulation Engine
      portfolio-management.mdx     # Portfolio Management
      life-events.mdx              # Life Event System
      monte-carlo.mdx              # Monte Carlo Projections
      scoring.mdx                  # Scoring & Behavioral Profiles
      ai-coach.mdx                 # AI Coach
      api-reference.mdx            # API Reference
  src/
    app/
      docs/
        [[...slug]]/
          page.tsx                 # Fumadocs dynamic route
        layout.tsx                 # Fumadocs layout
    lib/
      source.ts                    # Fumadocs source config
  source.config.ts                 # Fumadocs content config
```

## Dependencies to Add

- `fumadocs-core`
- `fumadocs-ui`
- `fumadocs-mdx`
- `@fumadocs-ui/rehype-*` (as needed)
