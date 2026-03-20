"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "var(--deep-navy)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Video background - CRT TV style */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "80%",
          height: "80%",
          borderRadius: "24px",
          border: "2px solid rgba(42, 77, 122, 0.55)",
          boxShadow: "0 24px 120px rgba(0, 0, 0, 0.65)",
          overflow: "hidden",
          zIndex: 1,
          background: "#000",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
            filter:
              "sepia(0.15) saturate(0.6) contrast(0.7) brightness(0.4) hue-rotate(-10deg) blur(0.5px)",
          }}
        >
          <source src="/videos/home.mp4" type="video/mp4" />
        </video>
        {/* CRT scanlines overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent 0px, transparent 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 6px)",
            backgroundSize: "100% 6px",
            pointerEvents: "none",
            zIndex: 2,
            mixBlendMode: "overlay" as const,
            animation: "tv-scroll 3s linear infinite",
          }}
        />
      </div>

      {/* Centered content */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          animation: "home-fadeIn 1.2s ease-out",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(32px, 5vw, 52px)",
            color: "var(--pixel-gold)",
            textAlign: "center",
            textShadow:
              "0 0 40px var(--pixel-gold-glow), 0 0 80px var(--pixel-gold-glow), 0 4px 0 var(--pixel-gold-dim), 0 6px 0 rgba(0,0,0,0.4)",
            letterSpacing: "6px",
            animation: "home-titlePulse 3s ease-in-out infinite",
            userSelect: "none",
            lineHeight: 1.2,
          }}
        >
          FUND FIGHT
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(20px, 3vw, 26px)",
            color: "var(--muted-gray-light)",
            letterSpacing: "4px",
            textTransform: "uppercase" as const,
            marginBottom: "32px",
            userSelect: "none",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          Invest • Compete • Learn
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            alignItems: "center",
            animation: "home-slideUp 1s ease-out 0.4s both",
          }}
        >
          <Link href="/game">
            <button
              style={{
                minWidth: "320px",
                textAlign: "center",
                fontFamily: "var(--font-heading)",
                fontSize: "15px",
                padding: "22px 48px",
                letterSpacing: "3px",
                cursor: "pointer",
                position: "relative",
                border: "none",
                color: "var(--deep-navy)",
                userSelect: "none",
                background:
                  "linear-gradient(180deg, #ffe066 0%, var(--pixel-gold) 40%, #c7a600 100%)",
                boxShadow:
                  "5px 5px 0 var(--pixel-gold-dim), 0 0 24px var(--pixel-gold-glow), 0 0 60px rgba(255,215,0,0.12)",
                clipPath:
                  "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
              }}
            >
              🎮  SANDBOX
            </button>
          </Link>
          <Link href="/leaderboard">
            <button
              style={{
                minWidth: "320px",
                textAlign: "center",
                fontFamily: "var(--font-heading)",
                fontSize: "15px",
                padding: "22px 48px",
                letterSpacing: "3px",
                cursor: "pointer",
                position: "relative",
                border: "none",
                color: "#fff",
                userSelect: "none",
                background:
                  "linear-gradient(180deg, #55ccff 0%, var(--pixel-blue) 40%, #0077cc 100%)",
                boxShadow:
                  "5px 5px 0 var(--pixel-blue-dim), 0 0 24px var(--pixel-blue-glow), 0 0 60px rgba(0,170,255,0.1)",
                clipPath:
                  "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
              }}
            >
              🏆  LEADERBOARD
            </button>
          </Link>
        </div>
      </div>

      {/* Decorative diamonds */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          marginTop: "-8px",
          fontSize: "10px",
          color: "var(--pixel-gold-dim)",
          opacity: 0.5,
        }}
      >
        ◆
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          fontFamily: "var(--font-heading)",
          fontSize: "8px",
          color: "var(--muted-gray)",
          letterSpacing: "1px",
          userSelect: "none",
          opacity: 0.4,
        }}
      >
        v0.1 • STARTHACK 2026
      </div>
    </div>
  );
}
