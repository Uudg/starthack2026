"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { useSeedData } from "@/lib/hooks/useSeedData";
import { GameProvider } from "@/lib/store/game-context";

const PROFILE_ICONS: Record<string, string> = {
  panic_seller: "🔴",
  cash_hoarder: "🏦",
  overthinker: "🔄",
  strategist: "🎯",
  diamond_hands: "💎",
  momentum_chaser: "📊",
};

function formatCHF(v: number): string {
  return `CHF ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function LeaderboardContent() {
  const { entries, fetchLeaderboard, loading } = useLeaderboard();
  const { availableSeeds, fetchSeeds } = useSeedData();
  const [selectedSeed, setSelectedSeed] = useState<string>("all");

  useEffect(() => {
    fetchSeeds();
  }, []);

  useEffect(() => {
    if (selectedSeed === "all") {
      fetchLeaderboard(undefined, 50);
    } else {
      fetchLeaderboard(selectedSeed, 50);
    }
  }, [selectedSeed]);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "var(--deep-navy)",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
      }}
      className="grid-bg"
    >
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "900px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(14px, 3vw, 24px)",
              color: "var(--pixel-gold)",
              textShadow: "0 0 16px var(--pixel-gold-glow)",
            }}
          >
            LEADERBOARD
          </h1>
          <Link href="/game" className="pixel-btn pixel-btn--gold">
            PLAY NOW
          </Link>
        </div>

        {/* Seed filter tabs */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
          <button
            className={`pixel-btn ${selectedSeed === "all" ? "pixel-btn--gold" : "pixel-btn--ghost"}`}
            style={{ fontSize: "8px", padding: "8px 16px" }}
            onClick={() => setSelectedSeed("all")}
          >
            ALL
          </button>
          {availableSeeds.map((seed) => (
            <button
              key={seed.id}
              className={`pixel-btn ${selectedSeed === seed.id ? "pixel-btn--gold" : "pixel-btn--ghost"}`}
              style={{ fontSize: "8px", padding: "8px 16px" }}
              onClick={() => setSelectedSeed(seed.id)}
            >
              {seed.name}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted-gray-light)", padding: "48px" }}>
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", fontFamily: "var(--font-body)", color: "var(--muted-gray-light)", padding: "48px" }}>
            No entries yet. Be the first to play!
          </div>
        ) : (
          <div className="pixel-panel pixel-panel--bright" style={{ padding: 0, overflow: "hidden" }}>
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "50px 1fr 80px 100px 100px 90px",
                gap: "8px",
                padding: "12px 16px",
                background: "var(--terminal-bg)",
                borderBottom: "2px solid var(--panel-border)",
                fontFamily: "var(--font-heading)",
                fontSize: "8px",
                color: "var(--muted-gray-light)",
              }}
            >
              <div>RANK</div>
              <div>PLAYER</div>
              <div>SCORE</div>
              <div>PORTFOLIO</div>
              <div>PROFILE</div>
              <div>TIME</div>
            </div>

            {entries.map((entry, i) => {
              const mins = Math.floor(entry.duration_seconds / 60);
              const secs = entry.duration_seconds % 60;
              return (
                <div
                  key={entry.session_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1fr 80px 100px 100px 90px",
                    gap: "8px",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--panel-border)",
                    fontFamily: "var(--font-body)",
                    fontSize: "17px",
                    background: i % 2 === 0 ? "var(--panel-bg)" : "transparent",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      color: i === 0 ? "var(--pixel-gold)" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "var(--muted-gray-light)",
                    }}
                  >
                    #{i + 1}
                  </div>
                  <div>
                    <div style={{ color: "var(--off-white)" }}>{entry.nickname}</div>
                    <div style={{ fontSize: "14px", color: "var(--muted-gray)" }}>{entry.avatar}</div>
                  </div>
                  <div style={{ color: "var(--pixel-green)", fontFamily: "var(--font-heading)", fontSize: "10px" }}>
                    {entry.composite_score.toFixed(0)}
                  </div>
                  <div style={{ color: "var(--pixel-gold)" }}>{formatCHF(entry.final_portfolio)}</div>
                  <div style={{ color: "var(--off-white)" }}>
                    {PROFILE_ICONS[entry.behavioral_profile] ?? "?"}{" "}
                    <span style={{ fontSize: "14px", color: "var(--muted-gray-light)" }}>
                      {entry.behavioral_profile.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div style={{ color: "var(--muted-gray-light)" }}>
                    {mins}:{secs.toString().padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <GameProvider>
      <LeaderboardContent />
    </GameProvider>
  );
}
