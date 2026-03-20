import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++)
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

export async function POST(request: Request) {
  try {
    const { playerId, seedId, startingPortfolio, monthlyContribution, tickSpeed } =
      await request.json();

    const supabase = createServerClient();

    // Fetch the seed to get total_weeks
    const { data: seed, error: seedErr } = await supabase
      .from("seeds")
      .select("total_weeks")
      .eq("id", seedId)
      .single();
    if (seedErr || !seed) {
      return NextResponse.json({ error: "Seed not found" }, { status: 404 });
    }

    // Generate unique room code
    let code = generateRoomCode();
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: existing } = await supabase
        .from("battle_rooms")
        .select("id")
        .eq("id", code)
        .neq("status", "finished")
        .maybeSingle();
      if (!existing) break;
      code = generateRoomCode();
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    const { data: room, error: roomErr } = await supabase
      .from("battle_rooms")
      .insert({
        id: code,
        seed_id: seedId,
        created_by: playerId,
        status: "waiting",
        starting_portfolio: startingPortfolio,
        monthly_contribution: monthlyContribution,
        tick_speed: tickSpeed ?? 3,
        event_timeout_secs: 10,
        current_tick: 0,
        total_ticks: seed.total_weeks,
        max_players: 2,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (roomErr) throw roomErr;

    const { data: player, error: playerErr } = await supabase
      .from("battle_players")
      .insert({
        room_id: code,
        player_id: playerId,
        is_ready: false,
        current_portfolio: startingPortfolio,
        is_eliminated: false,
        finished: false,
      })
      .select()
      .single();

    if (playerErr) throw playerErr;

    return NextResponse.json({ room, player, code }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: rooms, error } = await supabase
      .from("battle_rooms")
      .select("*")
      .eq("status", "waiting")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json(rooms ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
