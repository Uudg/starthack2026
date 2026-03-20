'use client'

import { useEffect, useRef } from 'react'
import type { CoachMessage } from '@/lib/hooks/useCoach'

const TRIGGER_LABELS: Record<string, string> = {
  game_start: '🎮 Game Start',
  game_end: '🏁 Game Over',
  life_event_before: '📋 Life Event',
  life_event_after: '✅ Decision Made',
  market_crash: '📉 Market Alert',
  market_recovery: '📈 Market Update',
  panic_rebalance: '⚠️ Panic Detected',
  all_in_equity: '🚀 All-In Equity',
  cash_heavy: '💵 Cash Heavy',
  milestone: '🎯 Milestone',
}

interface CoachPopupProps {
  message: CoachMessage | null
  isLoading: boolean
  onDismiss: () => void
}

export function CoachPopup({ message, isLoading, onDismiss }: CoachPopupProps) {
  const prevMessageId = useRef<string | null>(null)

  useEffect(() => {
    if (message && message.id !== prevMessageId.current) {
      prevMessageId.current = message.id
    }
  }, [message])

  if (!message && !isLoading) return null

  const label = message ? (TRIGGER_LABELS[message.trigger] ?? '🤖 Coach') : '🤖 Coach'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 340,
        background: '#1e293b',
        color: '#f1f5f9',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        zIndex: 1000,
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        animation: 'coachSlideIn 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes coachSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes coachDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#0f172a',
          borderBottom: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.5, color: '#94a3b8', textTransform: 'uppercase' }}>
            AI Coach
          </span>
          {label && (
            <span
              style={{
                background: '#1e40af',
                color: '#bfdbfe',
                borderRadius: 6,
                padding: '1px 7px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 4px',
          }}
          aria-label="Dismiss coach message"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', minHeight: 60 }}>
        {isLoading && !message?.text ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#60a5fa',
                  animation: `coachDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
            <span style={{ marginLeft: 6, fontSize: 12 }}>Thinking…</span>
          </div>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.55, color: '#e2e8f0' }}>
            {message?.text}
            {message?.isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 13,
                  background: '#60a5fa',
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'coachDot 0.8s ease-in-out infinite',
                }}
              />
            )}
          </p>
        )}
      </div>

      {/* Footer */}
      {message && !message.isStreaming && (
        <div
          style={{
            padding: '6px 14px 10px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onDismiss}
            style={{
              background: '#334155',
              border: 'none',
              color: '#94a3b8',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
