"use client";

import { useState } from "react";
import { useGame } from "@/lib/store/game-context";
import OnboardingScreen from "@/components/game/OnboardingScreen";
import PortfolioBuilderScreen from "@/components/game/PortfolioBuilderScreen";
import SimulationScreen from "@/components/game/SimulationScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import { Asset, Seed } from "@/lib/types";

interface OnboardingData {
  playerId: string;
  nickname: string;
  characterId: string;
  startingPortfolio: number;
  monthlyContribution: number;
  seedId: string;
}

interface SeedData {
  seed: Seed;
  assets: Asset[];
  prices: Record<string, number[]>;
  dates: string[];
}

export default function GamePage() {
  const { phase } = useGame();
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [seedData, setSeedData] = useState<SeedData | null>(null);

  if (phase === "idle" || phase === "loading" || phase === "onboarding") {
    return (
      <OnboardingScreen
        onComplete={(data, seed) => {
          setOnboardingData(data);
          setSeedData(seed);
        }}
      />
    );
  }

  if (phase === "portfolio") {
    if (!onboardingData || !seedData) return null;
    return (
      <PortfolioBuilderScreen
        seedData={seedData}
        startingPortfolio={onboardingData.startingPortfolio}
        monthlyContribution={onboardingData.monthlyContribution}
        playerId={onboardingData.playerId}
      />
    );
  }

  if (phase === "completing") {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--deep-navy)",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "12px",
            color: "var(--pixel-green)",
            animation: "pulse-glow 1s ease infinite",
          }}
        >
          CALCULATING RESULTS...
        </div>
      </div>
    );
  }

  if (phase === "results") {
    return <ResultsScreen seedData={seedData} />;
  }

  // simulating, paused, event
  return <SimulationScreen />;
}
