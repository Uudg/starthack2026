import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Tick speed → milliseconds between ticks
const TICK_MS: Record<number, number> = { 1: 800, 3: 270, 5: 160 };

interface BattleEventSchedule {
  tick: number;
  eventKey: string;
}

function getBattleEventSchedule(
  seed: { crash_weeks: number[] | null; historical_events: unknown },
  totalTicks: number,
): BattleEventSchedule[] {
  const events: BattleEventSchedule[] = [];

  events.push({ tick: 60, eventKey: "career.opportunity" });
  events.push({ tick: 140, eventKey: "personal.housing" });
  events.push({ tick: 280, eventKey: "personal.health" });

  const crashWeek = seed.crash_weeks?.[0];
  if (crashWeek != null && crashWeek > 0 && crashWeek < totalTicks - 30) {
    events.push({ tick: crashWeek, eventKey: "crisis.crash_news" });
  } else {
    events.push({ tick: 250, eventKey: "crisis.crash_news" });
  }

  const windfallTick = Math.min(400, totalTicks - 50);
  events.push({ tick: windfallTick, eventKey: "crisis.windfall" });

  return events.sort((a, b) => a.tick - b.tick);
}

function getEventForTick(
  tick: number,
  seed: { crash_weeks: number[] | null; historical_events: unknown },
  totalTicks: number,
): string | null {
  const schedule = getBattleEventSchedule(seed, totalTicks);
  const match = schedule.find((e) => e.tick === tick);
  return match?.eventKey ?? null;
}

function scheduleNextTick(roomId: string, delayMs: number, req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  setTimeout(() => {
    fetch(`${baseUrl}/api/battle/rooms/${roomId}/tick`, {
      method: "POST",
      headers: { "x-tick-internal": "true" },
    }).catch(console.error);
  }, delayMs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roomId } = await params;
  const supabase = createServerClient();

  // 1. Fetch current room state
  const { data: room } = await supabase
    .from("battle_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room || room.status !== "playing") {
    return NextResponse.json({ stopped: true });
  }

  // 2. Check if we're in an event decision window
  if (room.active_event_key && room.event_deadline) {
    const deadline = new Date(room.event_deadline);
    if (new Date() < deadline) {
      // Still waiting for choices — check if both players have chosen
      const { data: choices } = await supabase
        .from("battle_event_choices")
        .select("*")
        .eq("room_id", roomId)
        .eq("event_key", room.active_event_key);

      const { data: players } = await supabase
        .from("battle_players")
        .select("player_id")
        .eq("room_id", roomId);

      const allChosen = players?.every((p) =>
        choices?.some((c) => c.player_id === p.player_id),
      );

      if (!allChosen) {
        // Not everyone has chosen yet — schedule another check in 1 second
        scheduleNextTick(roomId, 1000, req);
        return NextResponse.json({ waiting: true });
      }
      // Everyone chose — clear event and continue
    }

    // Event window over — clear it
    await supabase
      .from("battle_rooms")
      .update({ active_event_key: null, event_deadline: null })
      .eq("id", roomId);
  }

  // 3. Advance tick
  const newTick = room.current_tick + 1;

  // 4. Check if game is complete
  if (newTick >= room.total_ticks) {
    await supabase
      .from("battle_rooms")
      .update({
        current_tick: newTick,
        status: "finished",
        game_end: new Date().toISOString(),
      })
      .eq("id", roomId);
    return NextResponse.json({ finished: true });
  }

  // 5. Check if a life event should fire at this tick
  const { data: seed } = await supabase
    .from("seeds")
    .select("crash_weeks, historical_events")
    .eq("id", room.seed_id)
    .single();

  const eventKey = getEventForTick(newTick, seed!, room.total_ticks);

  if (eventKey) {
    // Pause for event
    const deadline = new Date(
      Date.now() + room.event_timeout_secs * 1000,
    ).toISOString();
    await supabase
      .from("battle_rooms")
      .update({
        current_tick: newTick,
        active_event_key: eventKey,
        event_deadline: deadline,
      })
      .eq("id", roomId);

    // Schedule a check after the timeout
    scheduleNextTick(roomId, room.event_timeout_secs * 1000 + 500, req);
    return NextResponse.json({ event: eventKey });
  }

  // 6. Normal tick — just advance the counter
  await supabase
    .from("battle_rooms")
    .update({ current_tick: newTick })
    .eq("id", roomId);

  // 7. Schedule the next tick
  const interval = TICK_MS[room.tick_speed] ?? 270;
  scheduleNextTick(roomId, interval, req);

  return NextResponse.json({ tick: newTick });
}
