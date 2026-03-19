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
