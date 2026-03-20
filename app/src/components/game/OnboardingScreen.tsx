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
  easy: "var(--pixel-green)",
  medium: "var(--amber)",
  hard: "var(--pixel-red)",
};

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [startingPortfolio, setStartingPortfolio] = useState(10000);
  const [customPortfolio, setCustomPortfolio] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [loadingSeed, setLoadingSeed] = useState(false);

  const { createPlayer } = usePlayer();
  const { availableSeeds, fetchSeeds, fetchSeedData, seedData, loading } = useSeedData();
  const { phase } = useGame();

  useEffect(() => {
    fetchSeeds();
  }, []);

  function handleNicknameNext() {
    if (!nickname.trim()) {
      setNicknameError("Please enter a nickname");
      return;
    }
    setNicknameError("");
    setStep(2);
  }

  function handleCharacterNext() {
    if (!selectedCharacter) return;
    setStep(3);
  }

  function handlePortfolioNext() {
    setStep(4);
  }

  async function handleSeedSelect(seedId: string) {
    setSelectedSeedId(seedId);
    setLoadingSeed(true);
    await fetchSeedData(seedId);
    setLoadingSeed(false);
  }

  async function handleSubmit() {
    if (!selectedSeedId || !seedData || !selectedCharacter) return;

    const player = await createPlayer(nickname.trim(), selectedCharacter);
    if (!player) return;

    const portfolio = useCustom ? parseInt(customPortfolio) || 10000 : startingPortfolio;

    onComplete(
      {
        playerId: player.id,
        nickname: nickname.trim(),
        characterId: selectedCharacter,
        startingPortfolio: portfolio,
        monthlyContribution,
        seedId: selectedSeedId,
      },
      seedData
    );
  }

  const containerStyle: React.CSSProperties = {
    width: "100vw",
    minHeight: "100vh",
    background: "var(--deep-navy)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div style={containerStyle} className="grid-bg">
      {/* Background grid */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "800px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(14px, 3vw, 24px)",
              color: "var(--pixel-gold)",
              textShadow: "0 0 16px var(--pixel-gold-glow)",
              marginBottom: "8px",
            }}
          >
            FUND FIGHT
          </h1>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "20px",
              color: "var(--muted-gray-light)",
            }}
          >
            Step {step} of 4
          </div>
          {/* Step dots */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "12px" }}>
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                style={{
                  width: "12px",
                  height: "12px",
                  background: s <= step ? "var(--pixel-green)" : "var(--panel-border)",
                  boxShadow: s === step ? "0 0 8px var(--pixel-green-glow)" : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Nickname */}
        {step === 1 && (
          <div className="pixel-panel" style={{ animation: "slide-up 0.3s ease" }}>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "12px",
                color: "var(--off-white)",
                marginBottom: "24px",
              }}
            >
              WHAT IS YOUR NAME?
            </h2>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNicknameNext()}
              placeholder="Enter nickname..."
              maxLength={20}
              style={{
                width: "100%",
                background: "var(--terminal-bg)",
                border: `2px solid ${nicknameError ? "var(--pixel-red)" : "var(--panel-border)"}`,
                color: "var(--pixel-green)",
                fontFamily: "var(--font-heading)",
                fontSize: "14px",
                padding: "14px 16px",
                outline: "none",
                marginBottom: "8px",
                letterSpacing: "2px",
              }}
            />
            {nicknameError && (
              <div style={{ color: "var(--pixel-red)", fontFamily: "var(--font-body)", fontSize: "18px", marginBottom: "8px" }}>
                {nicknameError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button className="pixel-btn pixel-btn--gold" onClick={handleNicknameNext}>
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Character Select */}
        {step === 2 && (
          <div style={{ animation: "slide-up 0.3s ease" }}>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "11px",
                color: "var(--off-white)",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              CHOOSE YOUR CHARACTER
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              {CHARACTERS.map((char) => {
                const selected = selectedCharacter === char.id;
                return (
                  <div
                    key={char.id}
                    onClick={() => setSelectedCharacter(char.id)}
                    style={{
                      background: "var(--panel-bg)",
                      border: `2px solid ${selected ? char.accentColor : "var(--panel-border)"}`,
                      boxShadow: selected
                        ? `0 0 20px ${char.accentColor}44, 4px 4px 0 rgba(0,0,0,0.5)`
                        : "4px 4px 0 rgba(0,0,0,0.5)",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      transform: selected ? "translateY(-4px)" : "none",
                    }}
                  >
                    {/* Video */}
                    <div style={{ width: "100%", aspectRatio: "1", maxHeight: "160px", overflow: "hidden", marginBottom: "12px" }}>
                      <video
                        src={char.video}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    {/* Name */}
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "8px",
                        color: selected ? char.accentColor : "var(--off-white)",
                        marginBottom: "12px",
                        letterSpacing: "1px",
                      }}
                    >
                      {char.name}
                    </div>
                    {/* Stats */}
                    {(["riskTolerance", "patience", "greed"] as const).map((stat) => (
                      <div key={stat} style={{ marginBottom: "6px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontFamily: "var(--font-body)",
                            fontSize: "16px",
                            color: "var(--muted-gray-light)",
                            marginBottom: "2px",
                          }}
                        >
                          <span>{stat === "riskTolerance" ? "RISK" : stat.toUpperCase()}</span>
                          <span>{char.stats[stat]}</span>
                        </div>
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
                    ))}
                    {/* Quote */}
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "16px",
                        color: "var(--muted-gray-light)",
                        fontStyle: "italic",
                        marginTop: "8px",
                        borderTop: "1px solid var(--panel-border)",
                        paddingTop: "8px",
                      }}
                    >
                      &ldquo;{char.flavourQuote}&rdquo;
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="pixel-btn pixel-btn--ghost" onClick={() => setStep(1)}>
                ← BACK
              </button>
              <button
                className="pixel-btn pixel-btn--gold"
                onClick={handleCharacterNext}
                disabled={!selectedCharacter}
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Portfolio Setup */}
        {step === 3 && (
          <div className="pixel-panel" style={{ animation: "slide-up 0.3s ease" }}>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "11px",
                color: "var(--off-white)",
                marginBottom: "24px",
              }}
            >
              PORTFOLIO SETUP
            </h2>

            {/* Starting amount */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "9px", color: "var(--muted-gray-light)", marginBottom: "12px" }}>
                STARTING CAPITAL
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                {[5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    className={`pixel-btn ${!useCustom && startingPortfolio === amt ? "pixel-btn--gold" : "pixel-btn--ghost"}`}
                    style={{ fontSize: "9px", padding: "10px 18px" }}
                    onClick={() => { setStartingPortfolio(amt); setUseCustom(false); }}
                  >
                    CHF {amt.toLocaleString()}
                  </button>
                ))}
                <button
                  className={`pixel-btn ${useCustom ? "pixel-btn--gold" : "pixel-btn--ghost"}`}
                  style={{ fontSize: "9px", padding: "10px 18px" }}
                  onClick={() => setUseCustom(true)}
                >
                  CUSTOM
                </button>
              </div>
              {useCustom && (
                <input
                  type="number"
                  value={customPortfolio}
                  onChange={(e) => setCustomPortfolio(e.target.value)}
                  placeholder="Enter amount in CHF..."
                  style={{
                    width: "100%",
                    background: "var(--terminal-bg)",
                    border: "2px solid var(--panel-border)",
                    color: "var(--pixel-green)",
                    fontFamily: "var(--font-heading)",
                    fontSize: "12px",
                    padding: "12px",
                    outline: "none",
                  }}
                />
              )}
            </div>

            {/* Monthly contribution */}
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-heading)",
                  fontSize: "9px",
                  color: "var(--muted-gray-light)",
                  marginBottom: "12px",
                }}
              >
                <span>MONTHLY CONTRIBUTION</span>
                <span style={{ color: "var(--pixel-gold)" }}>CHF {monthlyContribution}</span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={50}
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(parseInt(e.target.value))}
                className="pixel-slider"
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray)", marginTop: "4px" }}>
                <span>CHF 0</span>
                <span>CHF 500</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="pixel-btn pixel-btn--ghost" onClick={() => setStep(2)}>
                ← BACK
              </button>
              <button className="pixel-btn pixel-btn--gold" onClick={handlePortfolioNext}>
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Seed Selection */}
        {step === 4 && (
          <div style={{ animation: "slide-up 0.3s ease" }}>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "11px",
                color: "var(--off-white)",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              CHOOSE YOUR ERA
            </h2>

            {loading && (
              <div style={{ textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted-gray-light)", padding: "32px" }}>
                Loading scenarios...
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              {availableSeeds.map((seed) => {
                const selected = selectedSeedId === seed.id;
                return (
                  <div
                    key={seed.id}
                    onClick={() => handleSeedSelect(seed.id)}
                    style={{
                      background: "var(--panel-bg)",
                      border: `2px solid ${selected ? "var(--pixel-green)" : "var(--panel-border)"}`,
                      boxShadow: selected
                        ? "0 0 20px var(--pixel-green-glow), 4px 4px 0 rgba(0,0,0,0.5)"
                        : "4px 4px 0 rgba(0,0,0,0.5)",
                      padding: "20px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      transform: selected ? "translateY(-4px)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div style={{ fontFamily: "var(--font-heading)", fontSize: "9px", color: "var(--off-white)" }}>
                        {seed.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "16px",
                          color: DIFFICULTY_COLORS[seed.difficulty] ?? "var(--off-white)",
                          padding: "2px 8px",
                          border: `1px solid ${DIFFICULTY_COLORS[seed.difficulty] ?? "var(--panel-border)"}`,
                          textTransform: "uppercase",
                        }}
                      >
                        {seed.difficulty}
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "18px", color: "var(--muted-gray-light)" }}>
                      {seed.description}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--muted-gray)", marginTop: "8px" }}>
                      {seed.start_date?.slice(0, 4)} – {seed.end_date?.slice(0, 4)}
                    </div>
                    {selected && loadingSeed && (
                      <div style={{ marginTop: "8px", fontFamily: "var(--font-body)", color: "var(--pixel-green)", animation: "pulse-glow 1s infinite" }}>
                        Loading data...
                      </div>
                    )}
                    {selected && !loadingSeed && seedData && (
                      <div style={{ marginTop: "8px", fontFamily: "var(--font-body)", fontSize: "16px", color: "var(--pixel-green)" }}>
                        ✓ Ready
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="pixel-btn pixel-btn--ghost" onClick={() => setStep(3)}>
                ← BACK
              </button>
              <button
                className="pixel-btn pixel-btn--gold pixel-btn--large"
                onClick={handleSubmit}
                disabled={!selectedSeedId || !seedData || loadingSeed}
              >
                BUILD PORTFOLIO →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
