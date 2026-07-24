import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stores a browser's push subscription so the cron can notify it later.
export async function POST(req: Request) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "push not configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint) return NextResponse.json({ error: "bad subscription" }, { status: 400 });

  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, subscription: sub }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
