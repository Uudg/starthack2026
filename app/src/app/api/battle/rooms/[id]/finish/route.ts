import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params;
    const { playerId, finalPortfolio, compositeScore, behavioralProfile, snapshots } =
      await request.json();
    const supabase = createServerClient();

    // Update battle player
    const { error: updateErr } = await supabase
      .from("battle_players")
      .update({
        finished: true,
        final_portfolio: finalPortfolio,
        composite_score: compositeScore,
        behavioral_profile: behavioralProfile,
      })
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (updateErr) throw updateErr;

    // Update linked game session with results
    const { data: bp } = await supabase
      .from("battle_players")
      .select("session_id")
      .eq("room_id", roomId)
      .eq("player_id", playerId)
      .single();

    if (bp?.session_id) {
      await supabase
        .from("game_sessions")
        .update({
          final_portfolio: finalPortfolio,
          composite_score: compositeScore,
          behavioral_profile: behavioralProfile,
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", bp.session_id);

      // Save snapshots if provided
      if (snapshots?.length) {
        const snapshotRows = snapshots.map((s: Record<string, unknown>) => ({
          ...s,
          session_id: bp.session_id,
        }));
        await supabase.from("portfolio_snapshots").insert(snapshotRows);
      }
    }

    // Check if both players finished
    const { data: allPlayers, error: playersErr } = await supabase
      .from("battle_players")
      .select("*")
      .eq("room_id", roomId);

    if (playersErr) throw playersErr;

    const bothFinished = allPlayers?.every((p) => p.finished) ?? false;

    if (bothFinished && allPlayers) {
      // Determine ranks
      const sorted = [...allPlayers].sort((a, b) => {
        // Higher composite score wins
        if ((b.composite_score ?? 0) !== (a.composite_score ?? 0)) {
          return (b.composite_score ?? 0) - (a.composite_score ?? 0);
        }
        // Tiebreak: higher portfolio
        return (b.final_portfolio ?? 0) - (a.final_portfolio ?? 0);
      });

      for (let i = 0; i < sorted.length; i++) {
        await supabase
          .from("battle_players")
          .update({ rank: i + 1 })
          .eq("id", sorted[i].id);
      }

      // Mark room as finished
      await supabase
        .from("battle_rooms")
        .update({ status: "finished", game_end: new Date().toISOString() })
        .eq("id", roomId);

      // Re-fetch with ranks
      const { data: finalPlayers } = await supabase
        .from("battle_players")
        .select("*")
        .eq("room_id", roomId);

      const myResult = finalPlayers?.find((p) => p.player_id === playerId);
      const opponentResult = finalPlayers?.find((p) => p.player_id !== playerId);

      const winner =
        myResult?.rank === opponentResult?.rank
          ? "tie"
          : (sorted[0]?.player_id ?? "tie");

      return NextResponse.json({
        yourResult: myResult,
        opponentResult,
        bothFinished: true,
        winner,
      });
    }

    // Opponent hasn't finished yet
    const myResult = allPlayers?.find((p) => p.player_id === playerId);
    const opponentResult = allPlayers?.find((p) => p.player_id !== playerId);

    return NextResponse.json({
      yourResult: myResult,
      opponentResult: opponentResult ?? null,
      bothFinished: false,
      winner: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
