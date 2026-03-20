"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--deep-navy)",
      }}
    >
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.5,
        }}
      >
        <source src="/videos/home.mp4" type="video/mp4" />
      </video>

      {/* CRT scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Centered content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(24px, 5vw, 56px)",
            color: "var(--pixel-gold)",
            textShadow: "0 0 30px var(--pixel-gold-glow), 4px 4px 0 rgba(0,0,0,0.5)",
            letterSpacing: "4px",
            textAlign: "center",
            lineHeight: 1.3,
            animation: "fadeIn 1s ease",
          }}
        >
          FUND FIGHT
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(20px, 3vw, 32px)",
            color: "var(--off-white)",
            letterSpacing: "3px",
            opacity: 0.8,
            animation: "fadeIn 1.2s ease",
          }}
        >
          INVEST THROUGH HISTORY
        </p>

        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "32px",
            flexWrap: "wrap",
            justifyContent: "center",
            animation: "slide-up 0.8s ease 0.5s both",
          }}
        >
          <Link href="/game">
            <button className="pixel-btn pixel-btn--gold pixel-btn--large">
              START GAME
            </button>
          </Link>
          <Link href="/leaderboard">
            <button className="pixel-btn pixel-btn--ghost pixel-btn--large">
              LEADERBOARD
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
