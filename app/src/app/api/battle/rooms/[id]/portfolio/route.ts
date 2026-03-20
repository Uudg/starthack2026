import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params;
    const { playerId, portfolio } = await request.json();
    const supabase = createServerClient();

    const { error } = await supabase
      .from("battle_players")
      .update({ current_portfolio: portfolio })
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
