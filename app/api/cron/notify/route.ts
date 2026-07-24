import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "America/New_York";
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

type Payload = { title: string; body: string; url: string; tag: string };

async function buildPayload(
  admin: NonNullable<ReturnType<typeof supabaseAdmin>>,
  slot: "morning" | "evening",
  today: string
): Promise<Payload> {
  if (slot === "morning") {
    const { data: ev } = await admin.from("events").select("id").eq("date", today);
    const n = ev?.length ?? 0;
    return {
      title: "Good morning ☀️",
      body: n
        ? `${n} thing${n > 1 ? "s" : ""} on today's agenda — set your intention & tick your habits.`
        : "A clear day ahead — set today's intention & tick your habits.",
      url: "/today",
      tag: "morning",
    };
  }

  const [wo, hb, hl] = await Promise.all([
    admin.from("workouts").select("minutes").eq("date", today),
    admin.from("habits").select("id"),
    admin.from("habit_logs").select("habit_id").eq("date", today),
  ]);
  const bikeMin = (wo.data ?? []).reduce((s, w) => s + (w.minutes as number), 0);
  const habitTotal = hb.data?.length ?? 0;
  const habitDone = new Set((hl.data ?? []).map((r) => r.habit_id)).size;
  const openHabits = Math.max(habitTotal - habitDone, 0);

  const pending: string[] = [];
  if (bikeMin < 30) pending.push("no ride yet");
  if (openHabits > 0) pending.push(`${openHabits} habit${openHabits > 1 ? "s" : ""} open`);

  return {
    title: "Evening check-in 🌙",
    body: pending.length
      ? `Still today: ${pending.join(" · ")}. A few minutes?`
      : "Everything's checked today. Nicely done. 🎉",
    url: "/today",
    tag: "evening",
  };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const admin = supabaseAdmin();
  if (!pub || !priv || !admin) {
    return NextResponse.json({ error: "push not configured" }, { status: 503 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@thelab", pub, priv);

  const slot = new URL(req.url).searchParams.get("slot") === "evening" ? "evening" : "morning";
  const payload = await buildPayload(admin, slot, todayET());

  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,subscription");
  let sent = 0;
  let pruned = 0;
  for (const row of subs ?? []) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify(payload));
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        pruned++;
      }
    }
  }

  return NextResponse.json({ ok: true, slot, sent, pruned });
}
