"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useGame } from "@/lib/store/game-context";
import { HistoricalEvent } from "@/lib/types";

/**
 * News overlay that mimics the demo-app's NewsOverlay.
 *
 * Flow:
 *  1. historicalNews fires → banner slides in from top
 *  2. After 400ms the full-screen popup auto-opens (game pauses)
 *  3. Popup shows video + typewriter headline
 *  4. User closes popup → game resumes, banner hides
 */
export default function NewsOverlay() {
  const { historicalNews, phase, play, pause } = useGame();

  const [bannerVisible, setBannerVisible] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const lastNewsRef = useRef<string | null>(null);
  const headlineRef = useRef("");
  const wasSimulating = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect new news
  useEffect(() => {
    if (!historicalNews) return;
    if (historicalNews.name === lastNewsRef.current) return;
    lastNewsRef.current = historicalNews.name;

    // Build headline
    const suffix =
      historicalNews.type === "crash" || historicalNews.type === "shock"
        ? " — Markets are under pressure. Stay calm."
        : historicalNews.type === "recovery" || historicalNews.type === "milestone"
        ? " — Signs of recovery emerging."
        : "";
    headlineRef.current = historicalNews.name + suffix;

    // Show banner
    setBannerVisible(true);
    setPopupOpen(false);
    setClosing(false);
    setTypedText("");
    setShowCursor(true);

    // Auto-open popup after 400ms
    popupTimerRef.current = setTimeout(() => {
      openPopup();
    }, 400);

    // Auto-hide banner after 8s if popup was closed before that
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setBannerVisible(false);
    }, 8000);

    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, [historicalNews]);

  // Typewriter effect
  useEffect(() => {
    if (!popupOpen) return;
    const headline = headlineRef.current;
    let idx = 0;
    setTypedText("");
    setShowCursor(true);

    typewriterRef.current = setInterval(() => {
      idx++;
      if (idx <= headline.length) {
        setTypedText(headline.slice(0, idx));
      } else {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        typewriterRef.current = null;
        setShowCursor(false);
      }
    }, 35);

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
        typewriterRef.current = null;
      }
    };
  }, [popupOpen]);

  function openPopup() {
    // Pause the game
    wasSimulating.current = phase === "simulating";
    pause();
    setPopupOpen(true);

    // Stop auto-hide while popup is open
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function closePopup() {
    setClosing(true);
    setTimeout(() => {
      setPopupOpen(false);
      setClosing(false);
      setBannerVisible(false);

      // Resume game if it was running
      if (wasSimulating.current) {
        play();
        wasSimulating.current = false;
      }
    }, 300);
  }

  function skipTypewriter() {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    setTypedText(headlineRef.current);
    setShowCursor(false);
  }

  const isCrash =
    historicalNews?.type === "crash" || historicalNews?.type === "shock";

  return (
    <>
      {/* ── BANNER (fixed top strip) ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "52px",
          zIndex: 9000,
          display: "flex",
          alignItems: "center",
          background:
            "linear-gradient(180deg, rgba(12,21,32,0.96), rgba(6,13,20,0.92))",
          borderBottom: `2px solid ${isCrash ? "var(--pixel-red)" : "var(--panel-border-bright)"}`,
          boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 16px ${isCrash ? "rgba(255,45,85,0.15)" : "rgba(255,184,48,0.08)"}`,
          overflow: "hidden",
          transform: bannerVisible ? "translateY(0)" : "translateY(-100%)",
          opacity: bannerVisible ? 1 : 0,
          pointerEvents: bannerVisible ? "auto" : "none",
          transition:
            "transform 0.45s cubic-bezier(0.2,0.9,0.2,1), opacity 0.3s ease",
          cursor: "pointer",
        }}
        onClick={() => {
          if (!popupOpen) openPopup();
        }}
      >
        {/* Scanlines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        {/* Badge */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: "var(--font-heading)",
            fontSize: "7px",
            color: "var(--terminal-bg)",
            background: isCrash ? "var(--pixel-red)" : "var(--amber)",
            padding: "5px 10px",
            margin: "0 12px",
            letterSpacing: "1.5px",
            animation: "pulse-glow 1.8s ease-in-out infinite",
            textShadow: "0 1px 0 rgba(0,0,0,0.3)",
            boxShadow: `0 0 8px ${isCrash ? "var(--pixel-red-glow)" : "rgba(255,184,48,0.35)"}`,
          }}
        >
          ⚡ BREAKING
        </span>
        {/* Ticker */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            height: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-body)",
              fontSize: "20px",
              color: isCrash ? "var(--pixel-red)" : "var(--amber)",
              textShadow: `0 0 6px ${isCrash ? "var(--pixel-red-glow)" : "rgba(255,184,48,0.25)"}`,
              animation: "ticker-scroll 18s linear infinite",
            }}
          >
            ⚡ {historicalNews?.name}{"   ◆   "}⚡ {historicalNews?.name}
            {"   ◆   "}
          </span>
        </div>
        {/* Arrow */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: "var(--font-heading)",
            fontSize: "9px",
            color: isCrash ? "var(--pixel-red)" : "var(--amber)",
            padding: "0 14px",
            opacity: 0.6,
            animation: "pulse-glow 1.2s step-end infinite",
          }}
        >
          ▶▶
        </span>
      </div>

      {/* ── POPUP (full-screen modal) ── */}
      {popupOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9500,
            background: "rgba(4,7,16,0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: closing
              ? "fadeOut 0.25s ease-in both"
              : "fadeIn 0.3s ease-out both",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePopup();
          }}
        >
          {/* Scanlines on backdrop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)",
              pointerEvents: "none",
            }}
          />

          {/* Popup card */}
          <div
            style={{
              position: "relative",
              width: "min(920px, 95vw)",
              background:
                "linear-gradient(180deg, rgba(16,24,34,0.97), rgba(8,15,24,0.95))",
              border: `3px solid ${isCrash ? "var(--pixel-red)" : "var(--panel-border-bright)"}`,
              boxShadow: `0 0 40px rgba(0,0,0,0.7), 0 0 20px ${isCrash ? "rgba(255,45,85,0.15)" : "rgba(255,184,48,0.1)"}, inset 0 0 60px rgba(0,200,100,0.02)`,
              animation: closing
                ? "none"
                : "slide-up 0.35s cubic-bezier(0.2,0.9,0.2,1) both",
              zIndex: 1,
              overflow: "hidden",
            }}
          >
            {/* CRT glow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at 50% 20%, rgba(255,184,48,0.04), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.06), transparent 40%)",
                pointerEvents: "none",
              }}
            />

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "var(--terminal-bg)",
                borderBottom: "2px solid var(--panel-border)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "9px",
                  color: isCrash ? "var(--pixel-red)" : "var(--amber)",
                  letterSpacing: "2px",
                  textShadow: `0 0 10px ${isCrash ? "var(--pixel-red-glow)" : "rgba(255,184,48,0.35)"}`,
                }}
              >
                📰 NEWS BULLETIN
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closePopup();
                }}
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "7px",
                  color: "var(--muted-gray-light)",
                  background: "var(--panel-bg)",
                  border: "2px solid var(--panel-border)",
                  padding: "5px 10px",
                  cursor: "pointer",
                  letterSpacing: "1px",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--pixel-red)";
                  e.currentTarget.style.color = "var(--pixel-red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--panel-border)";
                  e.currentTarget.style.color = "var(--muted-gray-light)";
                }}
              >
                [X] CLOSE
              </button>
            </div>

            {/* Video container */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "min(60vh, 500px)",
                overflow: "hidden",
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
                  imageRendering: "pixelated" as any,
                  filter: "contrast(1.1) saturate(1.15)",
                }}
              >
                <source src="/videos/news.mp4" type="video/mp4" />
              </video>

              {/* Text banner overlay at bottom */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(0,0,0,0.85)",
                  borderTop: `2px solid ${isCrash ? "var(--pixel-red)" : "var(--pixel-gold)"}`,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  backdropFilter: "blur(4px)",
                }}
              >
                {/* REC indicator */}
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "10px",
                    color: "var(--pixel-red)",
                    letterSpacing: "1px",
                    flexShrink: 0,
                    animation: "pulse-glow 1.5s step-end infinite",
                    textShadow: "0 0 8px var(--pixel-red-glow)",
                  }}
                >
                  ● REC
                </span>

                {/* Headline with typewriter */}
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "20px",
                    color: "var(--off-white)",
                    lineHeight: 1.4,
                    textAlign: "left",
                    flex: 1,
                    cursor: "pointer",
                    minHeight: "28px",
                  }}
                  onClick={skipTypewriter}
                >
                  {typedText}
                  {showCursor && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "18px",
                        background: "var(--amber)",
                        marginLeft: "2px",
                        verticalAlign: "middle",
                        animation: "blink-cursor 1s step-end infinite",
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
