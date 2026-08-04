import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accept the shared secret via Authorization header (Vercel) or ?secret= query
// (external pingers like cron-job.org).
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

const LEAD_MS = 15 * 60000; // fire up to 15 min before start
const GRACE_MS = 25 * 60000; // give up ~25 min after start

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const admin = supabaseAdmin();
  if (!pub || !priv || !admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@thelab", pub, priv);

  const now = Date.now();
  const { data: rems } = await admin.from("game_reminders").select("*").eq("sent", false);
  if (!rems?.length) return NextResponse.json({ ok: true, sent: 0 });

  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,subscription");
  let sent = 0;
  let expired = 0;

  for (const r of rems as any[]) {
    const startMs = new Date(r.start_iso).getTime();
    if (isNaN(startMs)) { await admin.from("game_reminders").update({ sent: true }).eq("id", r.id); continue; }
    if (now < startMs - LEAD_MS) continue; // still too early
    if (now > startMs + GRACE_MS) { await admin.from("game_reminders").update({ sent: true }).eq("id", r.id); expired++; continue; }

    const mins = Math.round((startMs - now) / 60000);
    const body = `Starts ${mins > 1 ? `in ${mins} min` : "now"}${r.tv ? ` · ${r.tv}` : ""}`;
    const payload = JSON.stringify({ title: `🏟️ ${r.matchup}`, body, url: "/sports", tag: `game-${r.game_id}` });

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification((s as any).subscription, payload);
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", (s as any).endpoint);
      }
    }
    await admin.from("game_reminders").update({ sent: true }).eq("id", r.id);
    sent++;
  }

  // tidy up reminders that are well in the past
  await admin.from("game_reminders").delete().eq("sent", true).lt("start_iso", new Date(now - 86400000).toISOString());

  return NextResponse.json({ ok: true, sent, expired });
}
