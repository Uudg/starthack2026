"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store/game-context";

export default function EventModal() {
  const { activeEvent, activeEventStats, chooseEventOption, state } = useGame();
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<"a" | "b" | null>(null);
  const [visible, setVisible] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Scale-in animation on mount
  useEffect(() => {
    if (activeEvent) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [activeEvent]);

  if (!activeEvent) return null;

  async function handleChoice(option: "a" | "b") {
    if (choosing) return;
    setChoosing(true);
    setChosen(option);
    await chooseEventOption(option);
    setChoosing(false);
    setChosen(null);
  }

  const totalVotes = activeEventStats
    ? activeEventStats.option_a_count + activeEventStats.option_b_count
    : 0;
  const pctA =
    totalVotes > 0
      ? Math.round((activeEventStats!.option_a_count / totalVotes) * 100)
      : null;
  const pctB =
    totalVotes > 0
      ? Math.round((activeEventStats!.option_b_count / totalVotes) * 100)
      : null;

  const chainSubtitle = activeEvent.chain
    ? activeEvent.chain.toUpperCase() + " EVENT"
    : "MARKET EVENT";

  return (
    <div className="event-popup-backdrop">
      <div
        ref={popupRef}
        className={`event-popup${visible ? " event-popup--visible" : ""}`}
      >
        {/* Pixel corner accents */}
        <div className="event-popup__corner event-popup__corner--tl" />
        <div className="event-popup__corner event-popup__corner--tr" />
        <div className="event-popup__corner event-popup__corner--bl" />
        <div className="event-popup__corner event-popup__corner--br" />

        {/* Header */}
        <div className="event-popup__header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>
              {activeEvent.icon}
            </span>
            <h2 className="event-popup__title">{activeEvent.title}</h2>
          </div>
          <p className="event-popup__subtitle">{chainSubtitle}</p>
        </div>

        {/* Body — event description */}
        <div className="event-popup__body">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="event-popup__text">{activeEvent.description}</p>
          </div>
        </div>

        {/* Social proof */}
        <div className="event-popup__social">
          {totalVotes > 0 && (
            <>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "16px",
                  color: "#8899aa",
                }}
              >
                {totalVotes.toLocaleString()} players faced this: {pctA}% chose
                A &bull; {pctB}% chose B
              </span>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "#1e3a5f",
                  overflow: "hidden",
                  marginTop: "4px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pctA}%`,
                    background:
                      "linear-gradient(90deg, #40c4ff, #00e676)",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Choices */}
        <div className="event-popup__choices">
          {(["a", "b"] as const).map((opt) => {
            const option =
              opt === "a" ? activeEvent.optionA : activeEvent.optionB;
            const isChosen = chosen === opt;
            return (
              <div key={opt} className="event-popup__choice">
                <button
                  className={`pixel-btn ${
                    opt === "b" ? "pixel-btn--red" : "pixel-btn--gold"
                  }`}
                  onClick={() => handleChoice(opt)}
                  disabled={choosing}
                  style={{
                    opacity: choosing && !isChosen ? 0.5 : 1,
                  }}
                >
                  {option.label}
                </button>
                <p className="event-popup__choice-desc">{option.hint}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
