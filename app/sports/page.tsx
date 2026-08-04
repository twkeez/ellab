"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DEFAULT_FAVORITES, isFavorite, whenLabel, type SportsData, type Game, type TennisEvent } from "@/lib/sports";

type Fav = { id: number; name: string };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

const LEAGUE_ORDER = ["MLB", "NFL", "NHL", "EPL", "UCL", "La Liga", "Serie A", "Bundesliga", "MLS"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SportsPage() {
  const [tod, setTod] = useState("day");
  const [data, setData] = useState<SportsData | null>(null);
  const [err, setErr] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [favs, setFavs] = useState<Fav[]>([]);
  const [favInput, setFavInput] = useState("");
  const [favErr, setFavErr] = useState(false);

  useEffect(() => { setTod(autoTod()); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/sports");
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (alive) setData(d);
      } catch { if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!.from("sports_favorites").select("id,name").order("created_at");
      if (alive && data) setFavs(data as Fav[]);
    })();
    return () => { alive = false; };
  }, []);

  const favNames = useMemo(() => [...DEFAULT_FAVORITES, ...favs.map((f) => f.name)], [favs]);

  const addFav = async () => {
    const v = favInput.trim();
    if (!v) return;
    if (favNames.some((f) => f.toLowerCase() === v.toLowerCase())) { setFavInput(""); return; }
    setFavInput("");
    setFavErr(false);
    // Show it right away, then reconcile with the saved row.
    const tempId = -Date.now();
    setFavs((f) => [...f, { id: tempId, name: v }]);
    if (supabase) {
      const { data, error } = await supabase.from("sports_favorites").insert({ name: v }).select("id,name").single();
      if (error) setFavErr(true);
      else if (data) setFavs((f) => f.map((x) => (x.id === tempId ? (data as Fav) : x)));
    }
  };
  const removeFav = async (f: Fav) => {
    setFavs((fs) => fs.filter((x) => x.id !== f.id));
    if (supabase) await supabase.from("sports_favorites").delete().eq("id", f.id);
  };

  const eff = (g: Game) => g.score + (isFavorite(g, favNames) ? 6 : 0);

  const worthWatching = useMemo(() => {
    if (!data) return [];
    return data.today
      .filter((g) => g.state !== "post")
      .map((g) => ({ g, s: eff(g) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, favNames]);

  const live = useMemo(() => (data?.today ?? []).filter((g) => g.state === "in"), [data]);

  const byLeague = (games: Game[]) => {
    const m: Record<string, Game[]> = {};
    for (const g of games) (m[g.league] ||= []).push(g);
    return LEAGUE_ORDER.filter((l) => m[l]?.length).map((l) => [l, m[l]] as [string, Game[]]);
  };

  const tvOf = (g: Game) => g.broadcasts.find((b) => g.national && /fox|espn|abc|nbc|tnt|tbs|cbs|peacock|apple|prime|usa|network/i.test(b)) || g.broadcasts[0] || "";

  const Row = ({ g, showReasons }: { g: Game; showReasons?: boolean }) => {
    const fav = isFavorite(g, favNames);
    const tv = tvOf(g);
    return (
      <div className={"sg" + (fav ? " fav" : "")}>
        <div className="sg-teams">
          {[g.away, g.home].map((t, i) => (
            <div key={i} className={"sg-team" + (t.winner ? " win" : "")}>
              <span className="sg-name">{t.short}{t.record ? <span className="sg-rec"> {t.record}</span> : null}</span>
              <span className="sg-score">{g.state === "pre" ? "" : t.score ?? ""}</span>
            </div>
          ))}
        </div>
        <div className="sg-side">
          <span className={"sg-when" + (g.state === "in" ? " live" : "")}>{g.state === "in" ? "● " : ""}{whenLabel(g, now)}</span>
          {tv && g.state !== "post" && <span className="sg-tv">{tv}</span>}
          {(showReasons || fav) && (
            <div className="sg-flags">
              {fav && <span className="sg-flag star">★ your team</span>}
              {g.drama && <span className="sg-flag hot">instant classic</span>}
              {showReasons && g.reasons.slice(0, 2).map((r, i) => <span key={i} className="sg-flag">{r}</span>)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const d = new Date(now);
  const dateline = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  const TennisRows = ({ t }: { t: TennisEvent }) => (
    <div className="sports-lg np-col-item">
      <p className="sports-lg-name">{t.tour} · {t.name}{t.major ? " ★" : ""}</p>
      {t.matches.map((m) => {
        const tv = m.broadcasts.find((b) => !/\.tv$/i.test(b)) ?? m.broadcasts[0];
        const when = m.state === "in" ? (m.detail || "Live") : m.state === "post" ? (m.detail || "Final")
          : m.startMs ? (() => { const mins = Math.round((m.startMs - now) / 60000); return mins <= 0 ? "Soon" : mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h`; })() : "";
        return (
          <div className="sg" key={m.id}>
            <div className="sg-teams">
              {[m.a, m.b].map((s, j) => (
                <div key={j} className={"sg-team" + (s.winner ? " win" : "")}>
                  <span className="sg-name">{s.name}{m.round ? <span className="sg-rec"> {m.round}</span> : null}</span>
                  <span className="sg-score" style={{ minWidth: "auto", letterSpacing: "0.08em" }}>{s.sets.join(" ")}</span>
                </div>
              ))}
            </div>
            <div className="sg-side">
              <span className={"sg-when" + (m.state === "in" ? " live" : "")}>{m.state === "in" ? "● " : ""}{when}</span>
              {tv && m.state !== "post" && <span className="sg-tv">{tv}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>

      <div className="newspaper">
        <div className="np-topbar">
          <Link href="/" className="np-back">← The Lab</Link>
          <span>Late Edition · No. 1</span>
        </div>
        <div className="np-plate">
          <h1 className="np-name">The Sports Page</h1>
        </div>
        <div className="np-folio">
          <span>{dateline}</span>
          <span className="np-folio-mid">All Scores · All Leagues</span>
          <span>Pittsburgh</span>
        </div>

        {!data && !err && <p className="np-note">Pulling the wire…</p>}
        {err && <p className="np-note">Couldn&apos;t reach the scores right now.</p>}

        {data && (
          <>
            {live.length > 0 && (
              <section className="np-section">
                <h2 className="np-head np-live">Live Now</h2>
                {live.map((g) => <Row key={g.id} g={g} showReasons />)}
              </section>
            )}

            <section className="np-section np-lead">
              <h2 className="np-head">Worth Watching Today</h2>
              {worthWatching.length === 0 ? (
                <p className="np-note">Nothing jumping out today — see the full slate below.</p>
              ) : (
                worthWatching.map((g) => <Row key={g.id} g={g} showReasons />)
              )}
            </section>

            {data.golf && (
              <section className="np-section">
                <h2 className="np-head">Golf — {data.golf.detail}</h2>
                <p className="sports-golf-name">{data.golf.name}</p>
                <div className="sports-golf-board">
                  {data.golf.leaders.map((l, i) => (
                    <div key={i} className="sports-golf-row"><span className="sg-rec">{l.pos}</span><span className="sg-name">{l.name}</span><span className="sg-score">{l.score}</span></div>
                  ))}
                </div>
              </section>
            )}

            {data.tennis.length > 0 && (
              <section className="np-section">
                <h2 className="np-head">Tennis</h2>
                <div className="np-cols">
                  {data.tennis.map((t, i) => <TennisRows key={i} t={t} />)}
                </div>
              </section>
            )}

            <section className="np-section">
              <h2 className="np-head">Today&apos;s Slate</h2>
              {byLeague(data.today).length === 0 ? (
                <p className="np-note">No games scheduled today.</p>
              ) : (
                <div className="np-cols">
                  {byLeague(data.today).map(([lg, games]) => (
                    <div key={lg} className="sports-lg np-col-item">
                      <p className="sports-lg-name">{lg}</p>
                      {games.map((g) => <Row key={g.id} g={g} />)}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="np-section">
              <h2 className="np-head">Yesterday&apos;s Final Scores</h2>
              {byLeague(data.yesterday).length === 0 ? (
                <p className="np-note">No finals from yesterday.</p>
              ) : (
                <div className="np-cols">
                  {byLeague(data.yesterday).map(([lg, games]) => (
                    <div key={lg} className="sports-lg np-col-item">
                      <p className="sports-lg-name">{lg}</p>
                      {games.map((g) => <Row key={g.id} g={g} />)}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="np-section">
              <h2 className="np-head">Your Teams</h2>
              <div className="sports-favs">
                <span className="sports-fav pinned">Cubs ⚾</span>
                {favs.map((f) => (
                  <span key={f.id} className="sports-fav">{f.name}<button className="ex-chip-x" aria-label={"Remove " + f.name} onClick={() => removeFav(f)}>×</button></span>
                ))}
              </div>
              <div className="step-add" style={{ marginTop: 10 }}>
                <input placeholder="add a team to flag (e.g. Bears, Arsenal)…" aria-label="Add a favorite team" value={favInput}
                  onChange={(e) => setFavInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFav(); }} />
                <button className="iconbtn" aria-label="Add team" onClick={addFav}>+</button>
              </div>
              {favErr ? (
                <p className="np-note" style={{ color: "var(--np-red)" }}>
                  Couldn&apos;t save — the <code>sports_favorites</code> table isn&apos;t set up yet. It&apos;ll stick once that&apos;s created.
                </p>
              ) : (
                <p className="np-note">Games with your teams get starred and bumped up the &ldquo;worth watching&rdquo; list.</p>
              )}
            </section>

            <p className="np-foot">— 30 —</p>
          </>
        )}
      </div>
    </div>
  );
}
