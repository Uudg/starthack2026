import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params;
    const supabase = createServerClient();

    const { data: room, error: roomErr } = await supabase
      .from("battle_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Fetch players with nickname/avatar from players table
    const { data: battlePlayers, error: playersErr } = await supabase
      .from("battle_players")
      .select("*")
      .eq("room_id", roomId);

    if (playersErr) throw playersErr;

    // Join with players table for nickname/avatar
    const playerIds = (battlePlayers ?? []).map((p) => p.player_id);
    const { data: playerProfiles } = await supabase
      .from("players")
      .select("id, nickname, avatar")
      .in("id", playerIds);

    const profileMap = new Map(
      (playerProfiles ?? []).map((p) => [p.id, p]),
    );

    const players = (battlePlayers ?? []).map((bp) => {
      const profile = profileMap.get(bp.player_id);
      return {
        ...bp,
        nickname: profile?.nickname ?? "Unknown",
        avatar: profile?.avatar ?? "🎮",
      };
    });

    return NextResponse.json({ room, players });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
