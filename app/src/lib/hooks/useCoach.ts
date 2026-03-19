import { useState, useRef, useCallback } from "react";
import { CoachTrigger, CoachContext } from "@/lib/engine/coach-prompts";

export interface CoachMessage {
  id: string;
  trigger: CoachTrigger;
  text: string;
  isStreaming: boolean;
  timestamp: number;
}

interface UseCoachReturn {
  currentMessage: CoachMessage | null;
  messageHistory: CoachMessage[];
  triggerCoach: (context: CoachContext) => void;
  dismiss: () => void;
  isLoading: boolean;
}

const COOLDOWN_MS = 8000;

export function useCoach(): UseCoachReturn {
  const [currentMessage, setCurrentMessage] = useState<CoachMessage | null>(null);
  const [messageHistory, setMessageHistory] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTriggerRef = useRef(0);

  const dismiss = useCallback(() => {
    setCurrentMessage(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const triggerCoach = useCallback((context: CoachContext) => {
    const now = Date.now();
    if (
      context.trigger !== "game_end" &&
      now - lastTriggerRef.current < COOLDOWN_MS
    ) {
      return;
    }
    lastTriggerRef.current = now;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    const abortController = new AbortController();
    abortRef.current = abortController;

    const messageId = crypto.randomUUID();
    const message: CoachMessage = {
      id: messageId,
      trigger: context.trigger,
      text: "",
      isStreaming: true,
      timestamp: Date.now(),
    };
    setCurrentMessage(message);
    setIsLoading(true);

    fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Coach request failed");

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullText += data.text;
                  setCurrentMessage((prev) =>
                    prev?.id === messageId ? { ...prev, text: fullText } : prev,
                  );
                }
              } catch {
                // skip
              }
            }
          }
        }

        const finalMessage: CoachMessage = {
          id: messageId,
          trigger: context.trigger,
          text: fullText,
          isStreaming: false,
          timestamp: Date.now(),
        };
        setCurrentMessage(finalMessage);
        setMessageHistory((prev) => [...prev, finalMessage]);
        setIsLoading(false);

        const dismissDelay = context.trigger === "game_end" ? 30000 : 12000;
        dismissTimerRef.current = setTimeout(() => {
          setCurrentMessage((prev) => (prev?.id === messageId ? null : prev));
        }, dismissDelay);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Coach error:", err);
          setIsLoading(false);
          setCurrentMessage(null);
        }
      });
  }, []);

  return { currentMessage, messageHistory, dismiss, triggerCoach, isLoading };
}
