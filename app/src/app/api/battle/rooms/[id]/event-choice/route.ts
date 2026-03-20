import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params;
    const { playerId, eventKey, chosen } = await request.json();
    const supabase = createServerClient();

    // Validate room
    const { data: room, error: roomErr } = await supabase
      .from("battle_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "playing") {
      return NextResponse.json({ error: "Game not in progress" }, { status: 409 });
    }

    if (room.active_event_key !== eventKey) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }

    // Validate player is in room
    const { data: player } = await supabase
      .from("battle_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("player_id", playerId)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Player not in room" }, { status: 403 });
    }

    // Insert choice (UNIQUE constraint prevents duplicates)
    const { error: insertErr } = await supabase
      .from("battle_event_choices")
      .insert({
        room_id: roomId,
        player_id: playerId,
        event_key: eventKey,
        chosen,
        chose_at: new Date().toISOString(),
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "Already chose" }, { status: 409 });
      }
      throw insertErr;
    }

    // Also insert into global event_choices for social proof stats (fire and forget)
    supabase
      .from("event_choices")
      .insert({
        session_id: null,
        event_key: eventKey,
        chain: eventKey.split(".")[0],
        chosen,
        portfolio_at_choice: 0,
      })
      .then(() => {});

    // Check if both players have chosen
    const { data: choices } = await supabase
      .from("battle_event_choices")
      .select("player_id, chosen")
      .eq("room_id", roomId)
      .eq("event_key", eventKey);

    const { data: allPlayers } = await supabase
      .from("battle_players")
      .select("player_id")
      .eq("room_id", roomId);

    const bothChosen = allPlayers?.every((p) =>
      choices?.some((c) => c.player_id === p.player_id),
    ) ?? false;

    if (bothChosen) {
      // Clear event and resume ticking
      await supabase
        .from("battle_rooms")
        .update({ active_event_key: null, event_deadline: null })
        .eq("id", roomId);
    }

    const opponentChoice = choices?.find((c) => c.player_id !== playerId);

    return NextResponse.json({
      yourChoice: chosen,
      opponentChoice: bothChosen ? opponentChoice?.chosen ?? null : null,
      bothChosen,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
