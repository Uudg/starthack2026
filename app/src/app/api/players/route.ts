import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { deviceId, nickname, avatar } = await request.json();
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("players")
      .select("*")
      .eq("device_id", deviceId)
      .single();

    if (existing) {
      // Update nickname/avatar if provided (re-onboarding)
      if (nickname && avatar && (existing.nickname !== nickname || existing.avatar !== avatar)) {
        const { data: updated } = await supabase
          .from("players")
          .update({ nickname, avatar })
          .eq("id", existing.id)
          .select()
          .single();
        if (updated) return NextResponse.json(updated, { status: 200 });
      }
      return NextResponse.json(existing, { status: 200 });
    }

    const { data, error } = await supabase
      .from("players")
      .insert({ device_id: deviceId, nickname, avatar })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
