import { NextResponse } from "next/server";
import type { Game, Golf, Team } from "@/lib/sports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const LEAGUES: { key: string; path: string; close: number }[] = [
  { key: "MLB", path: "baseball/mlb", close: 1 },
  { key: "NFL", path: "football/nfl", close: 3 },
  { key: "EPL", path: "soccer/eng.1", close: 1 },
  { key: "NHL", path: "hockey/nhl", close: 1 },
];

// A marquee national window vs. a regional sports network. RSNs (e.g. "NBC
// Sports California", "Marquee") and all-you-can-eat streaming (MLB.TV) don't
// count, even though they share words with national nets.
const NAT = /\b(fox|fs1|fs2|espn|espn2|abc|nbc|peacock|tnt|tbs|trutv|cbs|apple|prime|amazon|usa network|mlb network|nhl network|paramount)\b/i;
const RSN = /(nbc sports|nbcs\b|marquee|marq\b|masn|nesn|\bsny\b|bally|root sports|sportsnet|space city|\bmsg\b|\byes\b|spectrum|fanduel sports|\bfdsn\b|\.tv\b)/i;
function isNational(name: string): boolean {
  return NAT.test(name) && !RSN.test(name);
}

function etDate(offsetDays: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
  return s.replace(/-/g, "");
}

// A "contender" is comfortably above .500, not merely a game over — otherwise
// half of midseason baseball qualifies and the flag means nothing.
function isContender(rec: string | null): boolean {
  if (!rec) return false;
  const m = rec.match(/^(\d+)-(\d+)/);
  if (!m) return false;
  return parseInt(m[1], 10) - parseInt(m[2], 10) >= 5;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function team(c: any): Team {
  return {
    name: c?.team?.displayName ?? "TBD",
    short: c?.team?.shortDisplayName ?? c?.team?.name ?? "TBD",
    abbr: c?.team?.abbreviation ?? "",
    score: c?.score ?? null,
    record: (c?.records ?? [])[0]?.summary ?? null,
    winner: !!c?.winner,
  };
}

function normalize(leagueKey: string, closeMargin: number, ev: any): Game | null {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find((c: any) => c.homeAway === "home");
  const away = comp.competitors?.find((c: any) => c.homeAway === "away");
  if (!home || !away) return null;

  const st = ev?.status?.type ?? {};
  const state: Game["state"] = st.state === "in" ? "in" : st.state === "post" ? "post" : "pre";
  const detail = st.shortDetail ?? st.detail ?? st.description ?? "";
  const broadcasts: string[] = [];
  for (const b of comp.broadcasts ?? []) for (const n of b.names ?? []) if (n) broadcasts.push(n);
  const national = broadcasts.some((n) => isNational(n));

  const H = team(home);
  const A = team(away);
  const postseason = /post/i.test(ev?.season?.slug ?? "") || comp?.type?.abbreviation === "POST";

  let score = 0;
  const reasons: string[] = [];
  let drama = false;

  if (postseason) { score += 3; reasons.push("Playoffs"); }
  if (national) { score += 2; const net = broadcasts.find((n) => isNational(n)); reasons.push(net ? `Nat'l TV · ${net}` : "National TV"); }
  if (isContender(H.record) && isContender(A.record)) { score += 2; reasons.push("Two contenders"); }

  if (state === "post") {
    const hs = parseInt(H.score ?? "0", 10);
    const as = parseInt(A.score ?? "0", 10);
    const extra = /\/(OT|SO|1[0-9]|[ ]?F\/)/i.test(detail) || /OT|SO/i.test(detail);
    if (Math.abs(hs - as) <= closeMargin || extra) { score += 2; drama = true; reasons.push(extra ? "Extra time thriller" : "Nail-biter"); }
  } else if (state === "in") {
    score += 1;
    const hs = parseInt(H.score ?? "0", 10);
    const as = parseInt(A.score ?? "0", 10);
    if (Math.abs(hs - as) <= closeMargin) { score += 2; reasons.push("Tight & live"); }
  }

  return {
    league: leagueKey,
    id: String(ev.id),
    startISO: ev.date,
    startMs: new Date(ev.date).getTime(),
    state,
    detail,
    home: H,
    away: A,
    broadcasts,
    national,
    score,
    reasons,
    drama,
  };
}

async function fetchBoard(path: string, date: string): Promise<any[]> {
  try {
    const r = await fetch(`${BASE}/${path}/scoreboard?dates=${date}`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json();
    return d.events ?? [];
  } catch {
    return [];
  }
}

async function fetchGolf(): Promise<Golf> {
  try {
    const r = await fetch(`${BASE}/golf/pga/scoreboard`, { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    const ev = d.events?.[0];
    if (!ev) return null;
    const comps = ev.competitions?.[0]?.competitors ?? [];
    const leaders = comps.slice(0, 5).map((c: any) => ({
      pos: String(c.order ?? ""),
      name: c.athlete?.displayName ?? "",
      score: c.score ?? c.linescores?.slice(-1)[0]?.value ?? "",
    }));
    return {
      name: ev.name ?? "PGA Tour",
      detail: ev.status?.type?.shortDetail ?? ev.status?.type?.description ?? "",
      state: ev.status?.type?.state ?? "pre",
      leaders,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const today = etDate(0);
  const yesterday = etDate(-1);

  const todayJobs = LEAGUES.map((l) =>
    fetchBoard(l.path, today).then((evs) => evs.map((e) => normalize(l.key, l.close, e)).filter(Boolean) as Game[])
  );
  const yestJobs = LEAGUES.map((l) =>
    fetchBoard(l.path, yesterday).then((evs) =>
      (evs.map((e) => normalize(l.key, l.close, e)).filter(Boolean) as Game[]).filter((g) => g.state === "post")
    )
  );

  const [todayArrs, yestArrs, golf] = await Promise.all([
    Promise.all(todayJobs),
    Promise.all(yestJobs),
    fetchGolf(),
  ]);

  const todayGames = todayArrs.flat().sort((a, b) => a.startMs - b.startMs);
  const yesterdayGames = yestArrs.flat().sort((a, b) => b.score - a.score);

  return NextResponse.json({
    generatedAt: Date.now(),
    today: todayGames,
    yesterday: yesterdayGames,
    golf,
  });
}
