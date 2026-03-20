"use client";

import { useState, useEffect } from "react";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useSeedData } from "@/lib/hooks/useSeedData";
import { useGame } from "@/lib/store/game-context";
import { Asset, Seed } from "@/lib/types";

interface SeedData {
  seed: Seed;
  assets: Asset[];
  prices: Record<string, number[]>;
  dates: string[];
}

interface OnboardingData {
  playerId: string;
  nickname: string;
  characterId: string;
  startingPortfolio: number;
  monthlyContribution: number;
  seedId: string;
}

interface Props {
  onComplete: (data: OnboardingData, seedData: SeedData) => void;
}

const CHARACTERS = [
  {
    id: "analyst",
    name: "THE ANALYST",
    video: "/videos/characters/analyst.mp4",
    accentColor: "#40c4ff",
    stats: { riskTolerance: 45, patience: 90, greed: 20 },
    flavourQuote: "Spreadsheets don't lie. People do.",
  },
  {
    id: "hustler",
    name: "THE HUSTLER",
    video: "/videos/characters/hustler.mp4",
    accentColor: "#ff6d00",
    stats: { riskTolerance: 85, patience: 25, greed: 90 },
    flavourQuote: "Sleep is for people without alpha.",
  },
  {
    id: "retiree",
    name: "THE RETIREE",
    video: "/videos/characters/retiree.mp4",
    accentColor: "#66bb6a",
    stats: { riskTolerance: 20, patience: 95, greed: 10 },
    flavourQuote: "I've seen three crashes. I'll see three more.",
  },
  {
    id: "student",
    name: "THE STUDENT",
    video: "/videos/characters/student.mp4",
    accentColor: "#ce93d8",
    stats: { riskTolerance: 60, patience: 55, greed: 60 },
    flavourQuote: "I watched one YouTube video. How hard can it be?",
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#00e676",
  medium: "#ffab40",
  hard: "#ff1744",
};

const CAPITAL_PRESETS = [
  { label: "CHF 5K", value: 5000 },
  { label: "CHF 10K", value: 10000 },
  { label: "CHF 25K", value: 25000 },
];

export default function OnboardingScreen({ onComplete }: Props) {
  const [nickname, setNickname] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [startingPortfolio, setStartingPortfolio] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [loadingSeed, setLoadingSeed] = useState(false);

  const { player, loading: playerLoading, createPlayer } = usePlayer();
  const { availableSeeds, fetchSeeds, fetchSeedData, seedData, loading } = useSeedData();

  useEffect(() => {
    fetchSeeds();
  }, []);

  // Auto-fill from existing player (session persistence)
  useEffect(() => {
    if (player && !playerLoading) {
      if (player.nickname && !nickname) setNickname(player.nickname);
      if (player.avatar && !selectedCharacter) setSelectedCharacter(player.avatar);
    }
  }, [player, playerLoading]);

  // Auto-select first seed
  useEffect(() => {
    if (availableSeeds.length > 0 && !selectedSeedId) {
      setSelectedSeedId(availableSeeds[0].id);
      fetchSeedData(availableSeeds[0].id);
    }
  }, [availableSeeds]);

  async function handleSeedSelect(seedId: string) {
    setSelectedSeedId(seedId);
    setLoadingSeed(true);
    await fetchSeedData(seedId);
    setLoadingSeed(false);
  }

  async function handleSubmit() {
    if (!selectedSeedId || !seedData || !selectedCharacter) return;
    const p = await createPlayer(nickname.trim() || "Player", selectedCharacter);
    if (!p) return;
    onComplete(
      {
        playerId: p.id,
        nickname: nickname.trim() || "Player",
        characterId: selectedCharacter,
        startingPortfolio,
        monthlyContribution,
        seedId: selectedSeedId,
      },
      seedData
    );
  }

  return (
    <div className="character-select grid-bg" style={{ background: "var(--deep-navy)" }}>
      <h1 className="character-select__title">WEALTH MANAGER ARENA</h1>
      <p className="character-select__subtitle">Choose your investor character</p>

      {/* Character Grid */}
      <div className="character-select__grid">
        {CHARACTERS.map((char) => {
          const selected = selectedCharacter === char.id;
          return (
            <div
              key={char.id}
              className={`character-card${selected ? " character-card--selected" : ""}`}
              onClick={() => setSelectedCharacter(char.id)}
              style={{
                borderColor: selected ? char.accentColor : undefined,
                boxShadow: selected
                  ? `5px 5px 0 ${char.accentColor}aa, 0 0 28px ${char.accentColor}30`
                  : undefined,
              }}
            >
              <div className="character-card__video-wrap">
                <video
                  className="character-card__video"
                  src={char.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
              <div className="character-card__name" style={{ color: char.accentColor }}>
                {char.name}
              </div>
              <div className="character-card__role">
                {char.flavourQuote.split(" ").slice(0, 4).join(" ")}...
              </div>
              <div className="character-card__stats">
                {(["riskTolerance", "patience", "greed"] as const).map((stat) => (
                  <div key={stat} className="character-card__stat">
                    <span className="character-card__stat-label">
                      {stat === "riskTolerance" ? "RISK" : stat.toUpperCase()}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="pixel-stat-bar">
                        <div
                          className="pixel-stat-bar__fill"
                          style={{
                            width: `${char.stats[stat]}%`,
                            background: `linear-gradient(90deg, ${char.accentColor}88, ${char.accentColor})`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="character-card__quote">
                &ldquo;{char.flavourQuote}&rdquo;
              </div>
            </div>
          );
        })}
      </div>

      {/* Onboarding Panel - appears when character is selected */}
      {selectedCharacter && (
        <div
          className="onboarding-panel"
          style={{
            margin: "24px auto 0",
            padding: "20px",
            border: "2px solid #40c4ff",
            background: "rgba(7,9,15,0.97)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            animation: "slide-up 0.3s ease",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              color: "#40c4ff",
              textAlign: "center",
              margin: 0,
            }}
          >
            ⚙ SETUP YOUR GAME
          </h2>

          {/* Nickname */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "10px",
                color: "#8899aa",
                textTransform: "uppercase",
              }}
            >
              NICKNAME
            </span>
            <input
              type="text"
              placeholder="Enter your name..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#0a0e1a",
                border: "2px solid #1e3a5f",
                color: "#e8f4f8",
                fontFamily: "var(--font-body)",
                fontSize: "18px",
                outline: "none",
              }}
            />
          </div>

          {/* Scenario Selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "10px",
                color: "#8899aa",
                textTransform: "uppercase",
              }}
            >
              SCENARIO
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {availableSeeds.map((seed) => {
                const color = DIFFICULTY_COLORS[seed.difficulty] ?? "#40c4ff";
                const isSelected = seed.id === selectedSeedId;
                return (
                  <button
                    key={seed.id}
                    onClick={() => handleSeedSelect(seed.id)}
                    style={{
                      padding: "8px 16px",
                      border: `2px solid ${isSelected ? color : "#1e3a5f"}`,
                      background: isSelected ? color + "30" : "#0a0e1a",
                      color: color,
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {seed.name} [{seed.difficulty.toUpperCase()}]
                  </button>
                );
              })}
              {loading && (
                <span style={{ color: "#666", fontFamily: "var(--font-body)", fontSize: "16px" }}>
                  Loading...
                </span>
              )}
            </div>
          </div>

          {/* Starting Capital */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "10px",
                color: "#8899aa",
                textTransform: "uppercase",
              }}
            >
              STARTING CAPITAL
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {CAPITAL_PRESETS.map((preset) => {
                const isSelected = startingPortfolio === preset.value;
                return (
                  <button
                    key={preset.value}
                    onClick={() => setStartingPortfolio(preset.value)}
                    style={{
                      padding: "8px 14px",
                      border: `2px solid ${isSelected ? "#ffab40" : "#1e3a5f"}`,
                      background: isSelected ? "#ffab4030" : "#0a0e1a",
                      color: isSelected ? "#ffab40" : "#8899aa",
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monthly Contribution */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "10px",
                color: "#8899aa",
                textTransform: "uppercase",
              }}
            >
              MONTHLY: CHF {monthlyContribution}
            </span>
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(parseInt(e.target.value))}
              className="pixel-slider"
            />
          </div>

          {/* Start Button */}
          <div style={{ textAlign: "center", marginTop: "8px" }}>
            <button
              className="pixel-btn pixel-btn--gold pixel-btn--large"
              onClick={handleSubmit}
              disabled={!selectedSeedId || (!seedData && !loadingSeed) || loadingSeed}
            >
              {loadingSeed ? "LOADING..." : "START GAME →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
