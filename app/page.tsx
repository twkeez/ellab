"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "auto" | "morning" | "day" | "evening" | "night";
type Accent = "honey" | "green" | "teal" | "blue" | "purple" | "pink";
type MediaType = "book" | "film" | "music";

type Grocery = { id: number; text: string; done: boolean };
type MediaItem = { id: number; type: MediaType; title: string; author?: string };
type Wx = { city: string; tempF: number; label: string; rainLine: string };
type Note = { id: number; text: string };
type Chore = { id: number; name: string; last_done: string | null };

const DRAFT_KEY = "the-lab:draft";

// Most-neglected first: never-done (null) chores, then oldest last_done.
function sortChores(a: Chore, b: Chore): number {
  if (a.last_done === b.last_done) return a.id - b.id;
  if (a.last_done === null) return -1;
  if (b.last_done === null) return 1;
  return a.last_done < b.last_done ? -1 : 1;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SWATCHES: { name: Accent; hex: string }[] = [
  { name: "honey", hex: "#E8933A" },
  { name: "green", hex: "#5BBE6E" },
  { name: "teal", hex: "#37C1B6" },
  { name: "blue", hex: "#5AA6EE" },
  { name: "purple", hex: "#A98AF5" },
  { name: "pink", hex: "#F187AA" },
];

const SEGMENTS: { mode: Mode; label: string }[] = [
  { mode: "auto", label: "Auto" },
  { mode: "morning", label: "Morn" },
  { mode: "day", label: "Day" },
  { mode: "evening", label: "Eve" },
  { mode: "night", label: "Night" },
];

const SPARKS = [
  "a button that emails me a compliment when i'm grumpy",
  "a map of every coffee i've ever rated",
  "a timer that only runs while i keep talking",
  "a page that turns my day into a haiku",
  "a jar of small dares for when i'm bored",
  "a soundboard of my own catchphrases",
  "a mood ring that reads my typing speed",
  "a generator for absurd dog names",
];

function autoMode(hour: number): Exclude<Mode, "auto"> {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function greetFor(m: Exclude<Mode, "auto">): string {
  return { morning: "Good morning, Tom", day: "Hello, Tom", evening: "Good evening, Tom", night: "Late night, Tom" }[m];
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [accent, setAccent] = useState<Accent>("honey");

  const [wx, setWx] = useState<Wx | null>(null);
  const [wxError, setWxError] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [groceries, setGroceries] = useState<Grocery[]>([
    { id: 1, text: "Coffee beans", done: false },
    { id: 2, text: "Spinach", done: false },
    { id: 3, text: "Olive oil", done: true },
    { id: 4, text: "Lemons", done: false },
    { id: 5, text: "Parmesan", done: false },
  ]);
  const [grocInput, setGrocInput] = useState("");

  const [radar, setRadar] = useState<MediaItem[]>([
    { id: 1, type: "book", title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin" },
    { id: 2, type: "film", title: "Perfect Days", author: "Wim Wenders" },
    { id: 3, type: "music", title: "The Land Is Inhospitable…", author: "Mitski" },
    { id: 4, type: "book", title: "Piranesi", author: "Susanna Clarke" },
    { id: 5, type: "film", title: "Past Lives", author: "Celine Song" },
  ]);
  const [radarFilter, setRadarFilter] = useState<"all" | MediaType>("all");
  const [mediaInput, setMediaInput] = useState("");

  const [draft, setDraft] = useState("");
  const [pins, setPins] = useState<Note[]>([]);

  const [chores, setChores] = useState<Chore[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastDoneDate, setLastDoneDate] = useState<string | null>(null);

  const [sparkIndex, setSparkIndex] = useState(0);

  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nextId = useRef(1000);

  useEffect(() => {
    const t = () => setNow(new Date());
    t();
    const id = setInterval(t, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : null;
    if (saved) setDraft(saved);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data: g } = await supabase!
        .from("groceries")
        .select("id,text,done")
        .order("created_at");
      if (alive && g) setGroceries(g as Grocery[]);

      const { data: r } = await supabase!
        .from("radar_items")
        .select("id,type,title,author")
        .order("created_at");
      if (alive && r) setRadar(r as MediaItem[]);

      const { data: n } = await supabase!
        .from("notes")
        .select("id,text")
        .order("created_at");
      if (alive && n) setPins(n as Note[]);

      const { data: c } = await supabase!
        .from("chores")
        .select("id,name,last_done")
        .order("last_done", { ascending: true, nullsFirst: true })
        .order("created_at");
      if (alive && c) setChores(c as Chore[]);

      const { data: m } = await supabase!
        .from("app_meta")
        .select("streak,last_done_date")
        .eq("id", 1)
        .single();
      if (alive && m) {
        setStreak(m.streak ?? 0);
        setLastDoneDate(m.last_done_date ?? null);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/weather");
        if (!r.ok) throw new Error("bad response");
        const d: Wx = await r.json();
        if (alive) { setWx(d); setWxError(false); }
      } catch {
        if (alive) setWxError(true);
      }
    };
    load();
    const id = setInterval(load, 900000); // refresh every 15 min
    return () => { alive = false; clearInterval(id); };
  }, []);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const hour = now ? now.getHours() : 9;
  const tod = mode === "auto" ? autoMode(hour) : mode;
  const timeStr = now ? `${((now.getHours() % 12) || 12)}:${pad(now.getMinutes())}` : "—:—";
  const dateStr = now ? `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}` : "";

  const toggleGrocery = (g: Grocery) => {
    const next = !g.done;
    setGroceries((gs) => gs.map((x) => (x.id === g.id ? { ...x, done: next } : x)));
    if (supabase) {
      void supabase.from("groceries").update({ done: next }).eq("id", g.id);
    }
  };

  const addGrocery = async () => {
    const v = grocInput.trim();
    if (!v) return;
    setGrocInput("");
    if (supabase) {
      const { data } = await supabase
        .from("groceries")
        .insert({ text: v, done: false })
        .select("id,text,done")
        .single();
      if (data) setGroceries((gs) => [...gs, data as Grocery]);
    } else {
      setGroceries((gs) => [...gs, { id: nextId.current++, text: v, done: false }]);
    }
    say("added to groceries");
  };

  const addMedia = async () => {
    const v = mediaInput.trim();
    if (!v) return;
    const type: MediaType = radarFilter === "all" ? "book" : radarFilter;
    setMediaInput("");
    if (supabase) {
      const { data } = await supabase
        .from("radar_items")
        .insert({ type, title: v })
        .select("id,type,title,author")
        .single();
      if (data) setRadar((r) => [...r, data as MediaItem]);
    } else {
      setRadar((r) => [...r, { id: nextId.current++, type, title: v }]);
    }
    say("added to your radar");
  };

  const pinNote = async () => {
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    if (supabase) {
      const { data } = await supabase
        .from("notes")
        .insert({ text: v })
        .select("id,text")
        .single();
      if (data) setPins((p) => [...p, data as Note]);
    } else {
      setPins((p) => [...p, { id: nextId.current++, text: v }]);
    }
    say("pinned to the wall");
  };

  const focusChore = chores[0];

  const completeFocus = async () => {
    if (!focusChore) return;
    const nowDate = new Date();
    const today = ymd(nowDate);
    const yesterday = ymd(new Date(nowDate.getTime() - 86400000));
    const newStreak =
      lastDoneDate === today ? streak || 1 : lastDoneDate === yesterday ? streak + 1 : 1;
    const nowIso = nowDate.toISOString();

    setChores((cs) =>
      [...cs.map((c) => (c.id === focusChore.id ? { ...c, last_done: nowIso } : c))].sort(sortChores)
    );
    setStreak(newStreak);
    setLastDoneDate(today);
    say(`${focusChore.name.toLowerCase()} — done · streak ${newStreak}`);

    if (supabase) {
      await supabase.from("chores").update({ last_done: nowIso }).eq("id", focusChore.id);
      await supabase.from("app_meta").update({ streak: newStreak, last_done_date: today }).eq("id", 1);
    }
  };

  const shuffleSpark = () => setSparkIndex((i) => (i + 1) % SPARKS.length);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const fmtTimer = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

  const startTimer = (min: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (min === 0) {
      setRemaining(0);
      say("timer stopped");
      return;
    }
    setRemaining(min * 60);
    say(min + " minute timer started");
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          say("timer done — ding!");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const visibleRadar = radar.filter((m) => radarFilter === "all" || m.type === radarFilter);

  return (
    <div className="hub" data-tod={tod} data-accent={accent}>
      <h2 className="sr-only">
        The Lab home hub — a glanceable dashboard adapting its palette to the time of day, with a choosable accent color.
      </h2>

      <div className="aurora" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>

      <div className="wrap">
        <header className="top">
          <div>
            <div className="clock">
              <div className="time">{timeStr}</div>
              <div>
                <div className="greet">{greetFor(tod)}</div>
                <div className="date">{dateStr}</div>
              </div>
            </div>
            <div className="wx">
              {wx ? (
                <>{wx.city} · <b>{wx.tempF}°</b> {wx.label} · {wx.rainLine}</>
              ) : wxError ? (
                "Pittsburgh · weather unavailable right now"
              ) : (
                "Pittsburgh · checking the sky…"
              )}
            </div>
          </div>
          <div className="topright">
            <div className="chrome">
              <div className="swatches" role="group" aria-label="Accent color">
                {SWATCHES.map((s) => (
                  <button
                    key={s.name}
                    className={"sw" + (accent === s.name ? " on" : "")}
                    style={{ background: s.hex }}
                    aria-label={s.name}
                    aria-pressed={accent === s.name}
                    onClick={() => setAccent(s.name)}
                  />
                ))}
              </div>
              <div className="seg" role="group" aria-label="Time of day theme">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.mode}
                    className={mode === s.mode ? "on" : ""}
                    aria-pressed={mode === s.mode}
                    onClick={() => setMode(s.mode)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="primary" onClick={() => say("blank canvas → let's build")}>
                + New experiment
              </button>
              <button
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                style={{
                  border: "1px solid var(--border-2)",
                  borderRadius: 999,
                  background: "var(--field)",
                  color: "var(--text-soft)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="grid">
          <section className="tile c2 r2">
            <p className="eyebrow"><span className="dot" /> brain dump</p>
            <textarea
              className="dump"
              placeholder="what's rattling around today?"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (typeof window !== "undefined") window.localStorage.setItem(DRAFT_KEY, e.target.value);
              }}
            />
            <div className="dumprow">
              <button className="iconbtn" aria-label="Voice capture" onClick={() => say("listening… (voice capture)")}>
                🎙
              </button>
              <span className="note" style={{ flex: 1 }}>tap the mic to talk — easiest from the kitchen</span>
              <button className="mini accent" style={{ marginTop: 0 }} onClick={pinNote}>
                Pin it
              </button>
            </div>
            <div className="pins">
              {pins.map((p) => (
                <span key={p.id} className="pin-chip">{p.text}</span>
              ))}
            </div>
          </section>

          <section className="tile r2">
            <p className="eyebrow"><span className="dot" /> today</p>
            <ul className="list">
              <li><span className="ev-time">09:00</span><span className="gtext">Standup call</span></li>
              <li><span className="ev-time">13:00</span><span className="gtext">Lunch w/ Sam</span></li>
              <li><span className="ev-time">17:30</span><span className="gtext">Dog walk</span></li>
              <li><span className="ev-time">20:00</span><span className="gtext">Pasta night</span></li>
            </ul>
            <span className="fill" />
            <button className="mini" onClick={() => say("opening full calendar")}>Open calendar →</button>
          </section>

          <section className="tile r2">
            <p className="eyebrow"><span className="dot" /> groceries</p>
            <ul className="list">
              {groceries.map((g) => (
                <li key={g.id} className={g.done ? "done" : ""}>
                  <button
                    className={"check" + (g.done ? " done" : "")}
                    aria-label={"Toggle " + g.text}
                    aria-pressed={g.done}
                    onClick={() => toggleGrocery(g)}
                  >
                    {g.done ? "✓" : ""}
                  </button>
                  <span className="gtext">{g.text}</span>
                </li>
              ))}
            </ul>
            <div className="addrow">
              <input
                placeholder="add an item…"
                aria-label="Add grocery item"
                value={grocInput}
                onChange={(e) => setGrocInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addGrocery(); }}
              />
              <button className="iconbtn" aria-label="Add" onClick={addGrocery}>+</button>
            </div>
          </section>

          <section className="tile c2 r2">
            <p className="eyebrow"><span className="dot" /> on my radar · to explore</p>
            <div className="rfilters" role="group" aria-label="Filter radar">
              {(["all", "book", "film", "music"] as const).map((t) => (
                <button
                  key={t}
                  className={"rf" + (radarFilter === t ? " on" : "")}
                  aria-pressed={radarFilter === t}
                  onClick={() => setRadarFilter(t)}
                >
                  {t === "all" ? "All" : t === "book" ? "Books" : t === "film" ? "Films" : "Music"}
                </button>
              ))}
            </div>
            <ul className="list media">
              {visibleRadar.map((m) => (
                <li key={m.id}>
                  <span className="mtype">{m.type}</span>
                  <span className="gtext"><b>{m.title}</b>{m.author ? <> <i>{m.author}</i></> : null}</span>
                </li>
              ))}
            </ul>
            <div className="addrow">
              <input
                placeholder="add a book, film or album…"
                aria-label="Add to radar"
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addMedia(); }}
              />
              <button className="iconbtn" aria-label="Add" onClick={addMedia}>+</button>
            </div>
          </section>

          <section className="tile">
            <p className="eyebrow"><span className="dot" /> today&apos;s focus</p>
            <span className="fill" />
            <div className="focus-big">{focusChore ? focusChore.name : "All caught up ✨"}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
              <span className="streak">🔥&#8202;<b>{streak}</b>&#8202;day streak</span>
              {focusChore && (
                <button className="mini accent" style={{ marginTop: 0 }} onClick={completeFocus}>Done</button>
              )}
            </div>
          </section>

          <section className="tile">
            <p className="eyebrow"><span className="dot" /> dinner tonight</p>
            <span className="fill" />
            <div className="big">Lemon garlic pasta</div>
            <p className="note">25 min · you&apos;ve got most of it in already</p>
            <button className="mini accent" onClick={() => say("opening cooking mode — big steps + timers")}>Cook it →</button>
          </section>

          <section className="tile">
            <p className="eyebrow"><span className="dot" /> random spark</p>
            <p className="note" style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{SPARKS[sparkIndex]}</p>
            <button className="mini" onClick={shuffleSpark}>Shuffle</button>
          </section>

          <section className="tile">
            <p className="eyebrow"><span className="dot" /> timer</p>
            <span className="fill" />
            <div className="timer-num">{fmtTimer(remaining)}</div>
            <div className="presets">
              <button className="preset" onClick={() => startTimer(5)}>5m</button>
              <button className="preset" onClick={() => startTimer(10)}>10m</button>
              <button className="preset" onClick={() => startTimer(15)}>15m</button>
              <button className="preset" onClick={() => startTimer(0)}>stop</button>
            </div>
          </section>

          <section className="tile c2 studio">
            <p className="eyebrow"><span className="dot" /> writing studio · ai</p>
            <span className="fill" />
            <div className="draft">&ldquo;Slow mornings&rdquo; — 640 words</div>
            <p className="note">last edit 2 days ago · Claude suggested 3 new directions</p>
            <div className="row">
              <button className="mini accent" style={{ marginTop: 0 }} onClick={() => say("opening the writing studio")}>Resume writing</button>
              <button className="mini" style={{ marginTop: 0 }} onClick={() => say("fresh draft — Claude's ready")}>New idea</button>
            </div>
          </section>

          <section className="tile c2 tools">
            <p className="eyebrow" style={{ width: "100%" }}><span className="dot" /> jump into</p>
            <button className="toolbtn" onClick={() => say("opening recipes")}>Recipes</button>
            <button className="toolbtn" onClick={() => say("opening all chores")}>All chores</button>
            <button className="toolbtn" onClick={() => say("opening full calendar")}>Calendar</button>
            <button className="toolbtn" onClick={() => say("opening your 17 experiments")}>Experiments <span className="k">17</span></button>
          </section>
        </main>
      </div>

      <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
