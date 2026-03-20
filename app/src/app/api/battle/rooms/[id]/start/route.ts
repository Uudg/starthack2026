import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params;
    const { playerId } = await request.json();
    const supabase = createServerClient();

    // Fetch room
    const { data: room, error: roomErr } = await supabase
      .from("battle_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "countdown") {
      return NextResponse.json({ error: "Room is not in countdown" }, { status: 409 });
    }

    if (room.created_by !== playerId) {
      return NextResponse.json({ error: "Only room creator can start" }, { status: 403 });
    }

    // Update room to playing
    const { error: updateErr } = await supabase
      .from("battle_rooms")
      .update({
        status: "playing",
        game_start: new Date().toISOString(),
        current_tick: 0,
      })
      .eq("id", roomId);

    if (updateErr) throw updateErr;

    // Create game sessions for each player
    const { data: battlePlayers, error: bpErr } = await supabase
      .from("battle_players")
      .select("*")
      .eq("room_id", roomId);

    if (bpErr) throw bpErr;

    for (const bp of battlePlayers ?? []) {
      const { data: session, error: sessionErr } = await supabase
        .from("game_sessions")
        .insert({
          player_id: bp.player_id,
          seed_id: room.seed_id,
          starting_portfolio: room.starting_portfolio,
          monthly_contribution: room.monthly_contribution,
          completed: false,
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      await supabase
        .from("battle_players")
        .update({ session_id: session.id })
        .eq("id", bp.id);
    }

    // Kick off tick loop
    const baseUrl = request.nextUrl.origin;
    setTimeout(() => {
      fetch(`${baseUrl}/api/battle/rooms/${roomId}/tick`, {
        method: "POST",
        headers: { "x-tick-internal": "true" },
      }).catch(console.error);
    }, 500);

    // Fetch updated room
    const { data: updatedRoom } = await supabase
      .from("battle_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    return NextResponse.json({ room: updatedRoom });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
