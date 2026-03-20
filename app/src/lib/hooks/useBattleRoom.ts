import { useState, useEffect, useCallback, useRef } from "react";
import type { BattleRoom, BattlePlayer, BattleEventChoice } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";

interface UseBattleRoomReturn {
  // Room state
  room: BattleRoom | null;
  players: BattlePlayer[];
  myPlayer: BattlePlayer | null;
  opponent: BattlePlayer | null;

  // Status helpers
  isCreator: boolean;
  bothReady: boolean;
  bothFinished: boolean;
  isInEventWindow: boolean;
  eventSecondsLeft: number;

  // Current event choices
  myEventChoice: "a" | "b" | null;
  opponentEventChoice: "a" | "b" | null;

  // Actions
  createRoom: (config: {
    playerId: string;
    seedId: string;
    startingPortfolio: number;
    monthlyContribution: number;
    tickSpeed: 1 | 3 | 5;
  }) => Promise<string>;
  joinRoom: (code: string, playerId: string) => Promise<void>;
  setReady: (
    playerId: string,
    allocations: Array<{ assetId: string; pct: number }>,
  ) => Promise<void>;
  startGame: (playerId: string) => Promise<void>;
  submitEventChoice: (
    playerId: string,
    eventKey: string,
    chosen: "a" | "b",
  ) => Promise<void>;
  reportPortfolio: (playerId: string, portfolio: number) => Promise<void>;
  reportFinished: (
    playerId: string,
    results: {
      finalPortfolio: number;
      compositeScore: number;
      behavioralProfile: string;
      snapshots: unknown[];
    },
  ) => Promise<unknown>;

  // Loading/error
  loading: boolean;
  error: string | null;
}

export function useBattleRoom(myPlayerId: string | null): UseBattleRoomReturn {
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [eventChoices, setEventChoices] = useState<BattleEventChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventSecondsLeft, setEventSecondsLeft] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived values ──
  const myPlayer = players.find((p) => p.player_id === myPlayerId) ?? null;
  const opponent = players.find((p) => p.player_id !== myPlayerId) ?? null;
  const isCreator = room?.created_by === myPlayerId;
  const bothReady = players.length === 2 && players.every((p) => p.is_ready);
  const bothFinished = players.length === 2 && players.every((p) => p.finished);
  const isInEventWindow =
    room?.active_event_key != null && room?.event_deadline != null;

  const myEventChoice =
    eventChoices.find((c) => c.player_id === myPlayerId)?.chosen ?? null;
  const opponentEventChoice =
    eventChoices.find((c) => c.player_id !== myPlayerId)?.chosen ?? null;

  // ── Realtime subscription ──
  const subscribeToRoom = useCallback(
    (roomId: string) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase.channel(`battle:${roomId}`);

      // Listen for room changes
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setRoom(payload.new as unknown as BattleRoom);
        },
      );

      // Listen for player changes
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setPlayers((prev) => {
            const updated = payload.new as unknown as BattlePlayer;
            const existing = prev.findIndex((p) => p.id === updated.id);
            if (existing >= 0) {
              const copy = [...prev];
              copy[existing] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        },
      );

      // Listen for event choices
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_event_choices",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setEventChoices((prev) => [
            ...prev,
            payload.new as unknown as BattleEventChoice,
          ]);
        },
      );

      channel.subscribe();
      channelRef.current = channel;
    },
    [],
  );

  // ── Event countdown timer ──
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (room?.active_event_key && room?.event_deadline) {
      const update = () => {
        const deadline = new Date(room.event_deadline!).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
        setEventSecondsLeft(remaining);
      };
      update();
      countdownRef.current = setInterval(update, 500);
    } else {
      setEventSecondsLeft(0);
      if (!room?.active_event_key) {
        setEventChoices([]);
      }
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [room?.active_event_key, room?.event_deadline]);

  // ── Actions ──

  const createRoom = useCallback(
    async (config: {
      playerId: string;
      seedId: string;
      startingPortfolio: number;
      monthlyContribution: number;
      tickSpeed: 1 | 3 | 5;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/battle/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRoom(data.room);
        setPlayers([data.player].filter(Boolean));
        subscribeToRoom(data.room.id);
        return data.room.id as string;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [subscribeToRoom],
  );

  const joinRoom = useCallback(
    async (code: string, playerId: string) => {
      setLoading(true);
      setError(null);
      try {
        // First fetch room details
        const detailRes = await fetch(
          `/api/battle/rooms/${code.toUpperCase()}`,
        );
        if (!detailRes.ok) throw new Error("Room not found");
        const detail = await detailRes.json();
        setRoom(detail.room);
        setPlayers(detail.players || []);

        // Then join
        const res = await fetch(
          `/api/battle/rooms/${code.toUpperCase()}/join`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId }),
          },
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRoom(data.room);
        setPlayers(data.players || []);
        subscribeToRoom(data.room.id);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [subscribeToRoom],
  );

  const setReady = useCallback(
    async (
      playerId: string,
      allocations: Array<{ assetId: string; pct: number }>,
    ) => {
      if (!room) return;
      const res = await fetch(`/api/battle/rooms/${room.id}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, allocations }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    [room],
  );

  const startGame = useCallback(
    async (playerId: string) => {
      if (!room) return;
      const res = await fetch(`/api/battle/rooms/${room.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    [room],
  );

  const submitEventChoice = useCallback(
    async (playerId: string, eventKey: string, chosen: "a" | "b") => {
      if (!room) return;
      const res = await fetch(`/api/battle/rooms/${room.id}/event-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, eventKey, chosen }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    [room],
  );

  const reportPortfolio = useCallback(
    async (playerId: string, portfolio: number) => {
      if (!room) return;
      fetch(`/api/battle/rooms/${room.id}/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, portfolio }),
      }).catch(console.error); // fire and forget
    },
    [room],
  );

  const reportFinished = useCallback(
    async (
      playerId: string,
      results: {
        finalPortfolio: number;
        compositeScore: number;
        behavioralProfile: string;
        snapshots: unknown[];
      },
    ) => {
      if (!room) return;
      const res = await fetch(`/api/battle/rooms/${room.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, ...results }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    [room],
  );

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return {
    room,
    players,
    myPlayer,
    opponent,
    isCreator,
    bothReady,
    bothFinished,
    isInEventWindow,
    eventSecondsLeft,
    myEventChoice,
    opponentEventChoice,
    createRoom,
    joinRoom,
    setReady,
    startGame,
    submitEventChoice,
    reportPortfolio,
    reportFinished,
    loading,
    error,
  };
}
