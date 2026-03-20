import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params;
    const { playerId, allocations } = await request.json();
    const supabase = createServerClient();

    // Validate allocations sum to 100
    const total = (allocations as Array<{ assetId: string; pct: number }>).reduce(
      (s, a) => s + a.pct,
      0,
    );
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: "Allocations must sum to 100" },
        { status: 400 },
      );
    }

    // Update player
    const { error: updateErr } = await supabase
      .from("battle_players")
      .update({ is_ready: true, allocations })
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (updateErr) throw updateErr;

    // Check if all players are ready
    const { data: players, error: playersErr } = await supabase
      .from("battle_players")
      .select("*")
      .eq("room_id", roomId);

    if (playersErr) throw playersErr;

    const allReady =
      (players?.length ?? 0) >= 2 && players!.every((p) => p.is_ready);

    if (allReady) {
      await supabase
        .from("battle_rooms")
        .update({
          status: "countdown",
          countdown_start: new Date().toISOString(),
        })
        .eq("id", roomId);
    }

    // Fetch updated room
    const { data: room } = await supabase
      .from("battle_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    return NextResponse.json({ room, players });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
