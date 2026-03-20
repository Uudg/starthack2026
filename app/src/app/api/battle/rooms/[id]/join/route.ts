import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
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

    if (room.status !== "waiting") {
      return NextResponse.json({ error: "Game already started" }, { status: 409 });
    }

    // Check player count
    const { data: existingPlayers, error: countErr } = await supabase
      .from("battle_players")
      .select("*")
      .eq("room_id", roomId);

    if (countErr) throw countErr;

    if ((existingPlayers?.length ?? 0) >= room.max_players) {
      return NextResponse.json({ error: "Room is full" }, { status: 409 });
    }

    // Check if already joined
    if (existingPlayers?.some((p) => p.player_id === playerId)) {
      return NextResponse.json({ error: "Already joined" }, { status: 409 });
    }

    // Insert new player
    const { data: newPlayer, error: insertErr } = await supabase
      .from("battle_players")
      .insert({
        room_id: roomId,
        player_id: playerId,
        is_ready: false,
        current_portfolio: room.starting_portfolio,
        is_eliminated: false,
        finished: false,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Fetch all players with profiles
    const allPlayers = [...(existingPlayers ?? []), newPlayer];
    const playerIds = allPlayers.map((p) => p.player_id);
    const { data: profiles } = await supabase
      .from("players")
      .select("id, nickname, avatar")
      .in("id", playerIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const players = allPlayers.map((bp) => {
      const profile = profileMap.get(bp.player_id);
      return {
        ...bp,
        nickname: profile?.nickname ?? "Unknown",
        avatar: profile?.avatar ?? "🎮",
      };
    });

    return NextResponse.json({ room, players }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
