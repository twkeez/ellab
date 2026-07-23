"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WxIcon, SunriseIcon, SunsetIcon, DropletIcon, aqiColor } from "@/components/WxIcons";

type Mode = "auto" | "morning" | "day" | "evening" | "night";
type Accent = "honey" | "green" | "teal" | "blue" | "purple" | "pink";
type MediaType = "book" | "film" | "music" | "game";

type Grocery = { id: number; text: string; done: boolean };
type MediaItem = { id: number; type: MediaType; title: string; author?: string };
type Wx = {
  city: string;
  tempF: number;
  label: string;
  icon?: string;
  rainLine: string;
  sunrise?: string;
  sunset?: string;
  sunriseMin?: number;
  sunsetMin?: number;
  aqi?: number | null;
  aqiLabel?: string | null;
};
type Recipe = { name: string; category: string; area: string; source: string };
type Note = { id: number; text: string };
type Chore = { id: number; name: string; last_done: string | null };
type NewsItem = { title: string; source: string; link: string };
type Dismissal = { title: string; link: string; source: string };

// Words too common to carry meaning — ignored when learning what you dislike.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "with", "at",
  "by", "from", "as", "is", "are", "was", "were", "be", "this", "that", "these", "those",
  "new", "how", "why", "what", "when", "who", "after", "over", "into", "its", "his", "her",
  "their", "they", "will", "has", "have", "had", "not", "you", "your", "out", "up", "off",
  "about", "more", "most", "than", "then", "some", "just", "can", "could", "would", "should",
]);

function keywords(title: string): string[] {
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    )
  );
}

// Hide anything you've dismissed, then push down stories that share the outlet
// or recurring words of things you keep dismissing. Recency breaks ties.
function rankNews(news: NewsItem[], dismissals: Dismissal[]): NewsItem[] {
  const dismissedLinks = new Set(dismissals.map((d) => d.link));
  const sourcePenalty: Record<string, number> = {};
  const wordPenalty: Record<string, number> = {};
  for (const d of dismissals) {
    sourcePenalty[d.source] = (sourcePenalty[d.source] ?? 0) + 1;
    for (const w of keywords(d.title)) wordPenalty[w] = (wordPenalty[w] ?? 0) + 1;
  }
  return news
    .filter((n) => !dismissedLinks.has(n.link))
    .map((n, idx) => {
      let penalty = sourcePenalty[n.source] ?? 0;
      for (const w of keywords(n.title)) penalty += wordPenalty[w] ?? 0;
      return { n, idx, penalty };
    })
    .sort((a, b) => a.penalty - b.penalty || a.idx - b.idx)
    .map((s) => s.n);
}

const DRAFT_KEY = "the-lab:draft";

// Quick-capture routing: "book - dungeon crawler carl" lands on the radar,
// "groceries - apples" on the shopping list. No prefix = a pinned thought.
const PREFIX_MAP: Record<string, string> = {
  book: "book", books: "book", read: "book", reading: "book",
  movie: "film", movies: "film", film: "film", films: "film", watch: "film",
  music: "music", album: "music", albums: "music", song: "music", listen: "music",
  game: "game", games: "game", videogame: "game", videogames: "game", play: "game",
  grocery: "groceries", groceries: "groceries", buy: "groceries", shop: "groceries", food: "groceries",
  chore: "chore", chores: "chore", clean: "chore", todo: "chore",
  note: "note", idea: "note", thought: "note",
};

const DEST_LABEL: Record<string, string> = {
  book: "books", film: "films", music: "music", game: "games",
  groceries: "groceries", chore: "chores", note: "notes",
};

const RADAR_LABEL: Record<string, string> = {
  all: "All", book: "Books", film: "Films", music: "Music", game: "Games",
};

function parseEntry(line: string): { dest: string; text: string } {
  const m = line.match(/^([a-zA-Z]+)\s*[-:–—]\s*(.+)$/);
  if (m) {
    const dest = PREFIX_MAP[m[1].toLowerCase()];
    if (dest) return { dest, text: m[2].trim() };
  }
  return { dest: "note", text: line };
}

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

// Time-of-day driven by actual sun times: morning is the first few hours after
// sunrise, evening is golden-hour into dusk, night wraps around.
function todFromSun(nowMin: number, sunriseMin: number, sunsetMin: number): Exclude<Mode, "auto"> {
  if (nowMin < sunriseMin - 30 || nowMin >= sunsetMin + 60) return "night";
  if (nowMin < sunriseMin + 210) return "morning";
  if (nowMin >= sunsetMin - 90) return "evening";
  return "day";
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

  const [news, setNews] = useState<NewsItem[]>([]);
  const [dismissals, setDismissals] = useState<Dismissal[]>([]);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

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

      const { data: nd } = await supabase!
        .from("news_dismissals")
        .select("title,link,source");
      if (alive && nd) setDismissals(nd as Dismissal[]);
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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/news");
        if (!r.ok) return;
        const d = await r.json();
        if (alive && Array.isArray(d.items)) setNews(d.items);
      } catch {
        // leave the feed empty on failure
      }
    };
    load();
    const id = setInterval(load, 1800000); // refresh every 30 min
    return () => { alive = false; clearInterval(id); };
  }, []);

  const loadRecipe = useCallback(async () => {
    try {
      const r = await fetch("/api/recipe");
      if (!r.ok) return;
      const d: Recipe = await r.json();
      if (d && d.name) setRecipe(d);
    } catch {
      // leave the previous suggestion in place on failure
    }
  }, []);

  useEffect(() => { loadRecipe(); }, [loadRecipe]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 9 * 60;
  const tod =
    mode !== "auto"
      ? mode
      : wx && wx.sunriseMin != null && wx.sunsetMin != null
      ? todFromSun(nowMin, wx.sunriseMin, wx.sunsetMin)
      : autoMode(Math.floor(nowMin / 60));
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

  const routeEntry = async (dest: string, text: string) => {
    if (dest === "groceries") {
      if (supabase) {
        const { data } = await supabase
          .from("groceries").insert({ text, done: false }).select("id,text,done").single();
        if (data) setGroceries((g) => [...g, data as Grocery]);
      } else {
        setGroceries((g) => [...g, { id: nextId.current++, text, done: false }]);
      }
    } else if (dest === "book" || dest === "film" || dest === "music" || dest === "game") {
      const type = dest as MediaType;
      if (supabase) {
        const { data } = await supabase
          .from("radar_items").insert({ type, title: text }).select("id,type,title,author").single();
        if (data) setRadar((r) => [...r, data as MediaItem]);
      } else {
        setRadar((r) => [...r, { id: nextId.current++, type, title: text }]);
      }
    } else if (dest === "chore") {
      if (supabase) {
        const { data } = await supabase
          .from("chores").insert({ name: text }).select("id,name,last_done").single();
        if (data) setChores((c) => [...c, data as Chore].sort(sortChores));
      } else {
        setChores((c) => [...c, { id: nextId.current++, name: text, last_done: null }].sort(sortChores));
      }
    } else {
      if (supabase) {
        const { data } = await supabase.from("notes").insert({ text }).select("id,text").single();
        if (data) setPins((p) => [...p, data as Note]);
      } else {
        setPins((p) => [...p, { id: nextId.current++, text }]);
      }
    }
  };

  const sendDump = async () => {
    const lines = draft.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setDraft("");
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);

    let last = "note";
    for (const line of lines) {
      const { dest, text } = parseEntry(line);
      if (!text) continue;
      await routeEntry(dest, text);
      last = dest;
    }
    say(
      lines.length > 1
        ? `captured ${lines.length} things`
        : last === "note"
        ? "pinned to the wall"
        : `added to ${DEST_LABEL[last]}`
    );
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

  const dismissNews = (n: NewsItem) => {
    setDismissals((d) => [...d, { title: n.title, link: n.link, source: n.source }]);
    if (supabase) {
      void supabase.from("news_dismissals").insert({ title: n.title, link: n.link, source: n.source });
    }
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
  const rankedNews = useMemo(() => rankNews(news, dismissals), [news, dismissals]);

  const draftLines = draft.split("\n").map((l) => l.trim()).filter(Boolean);
  const draftDest = draftLines.length === 1 ? parseEntry(draftLines[0]).dest : null;
  const sendLabel =
    draftLines.length > 1
      ? `Capture ${draftLines.length}`
      : draftDest && draftDest !== "note"
      ? `Add to ${DEST_LABEL[draftDest]}`
      : "Pin it";

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
                <>
                  <div className="wx-now">
                    <WxIcon kind={wx.icon} size={26} style={{ color: "var(--accent)" }} />
                    <span className="wx-temp">{wx.tempF}°</span>
                    <span className="wx-cond">{wx.city} · {wx.label}</span>
                  </div>
                  <div className="wx-chips">
                    <span className="wx-chip">
                      <DropletIcon />
                      {wx.rainLine.startsWith("no rain") ? "no rain" : wx.rainLine.replace("rain likely around ", "rain ~")}
                    </span>
                    {wx.aqi != null && (
                      <span className="wx-chip">
                        <span className="aqi-dot" style={{ background: aqiColor(wx.aqi) }} />
                        air {wx.aqi} · {wx.aqiLabel}
                      </span>
                    )}
                    {wx.sunrise && (
                      <span className="wx-chip"><SunriseIcon />{wx.sunrise}</span>
                    )}
                    {wx.sunset && (
                      <span className="wx-chip"><SunsetIcon />{wx.sunset}</span>
                    )}
                  </div>
                </>
              ) : wxError ? (
                <span className="wx-cond">Pittsburgh · weather unavailable right now</span>
              ) : (
                <span className="wx-cond">Pittsburgh · checking the sky…</span>
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
              placeholder={"what's rattling around today?\ntry: book - dungeon crawler carl"}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (typeof window !== "undefined") window.localStorage.setItem(DRAFT_KEY, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendDump(); }
              }}
            />
            <div className="dumprow">
              <button className="iconbtn" aria-label="Voice capture" onClick={() => say("listening… (voice capture)")}>
                🎙
              </button>
              <span className="note" style={{ flex: 1 }}>
                <code className="pfx">book</code> <code className="pfx">film</code> <code className="pfx">music</code>{" "}
                <code className="pfx">game</code> <code className="pfx">groceries</code> <code className="pfx">chore</code> — or a thought
              </span>
              <button className="mini accent" style={{ marginTop: 0 }} onClick={sendDump}>
                {sendLabel}
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
              {(["all", "book", "film", "music", "game"] as const).map((t) => (
                <button
                  key={t}
                  className={"rf" + (radarFilter === t ? " on" : "")}
                  aria-pressed={radarFilter === t}
                  onClick={() => setRadarFilter(t)}
                >
                  {RADAR_LABEL[t]}
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
                placeholder="add a book, film, album or game…"
                aria-label="Add to radar"
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addMedia(); }}
              />
              <button className="iconbtn" aria-label="Add" onClick={addMedia}>+</button>
            </div>
          </section>

          <section className="tile c2 r2">
            <p className="eyebrow"><span className="dot" /> the feed · books, film &amp; pittsburgh</p>
            <ul className="list news">
              {rankedNews.length === 0 ? (
                <li><span className="gtext" style={{ color: "var(--text-soft)" }}>catching the latest…</span></li>
              ) : (
                rankedNews.slice(0, 5).map((n) => (
                  <li key={n.link}>
                    <a href={n.link} target="_blank" rel="noopener noreferrer">
                      <span className="src">{n.source}</span>{n.title}
                    </a>
                    <button
                      className="news-x"
                      aria-label="Show less like this"
                      title="Show less like this"
                      onClick={() => dismissNews(n)}
                    >
                      ×
                    </button>
                  </li>
                ))
              )}
            </ul>
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
            <p className="eyebrow"><span className="dot" /> dinner idea</p>
            <div className="big" style={{ fontSize: "1.2rem", marginTop: 2 }}>
              {recipe ? recipe.name : "finding an idea…"}
            </div>
            {recipe && <p className="note">{recipe.area} · {recipe.category}</p>}
            <span className="fill" />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="mini accent"
                style={{ marginTop: 0 }}
                onClick={() => recipe?.source && window.open(recipe.source, "_blank", "noopener,noreferrer")}
              >
                Cook it →
              </button>
              <button className="mini" style={{ marginTop: 0 }} onClick={loadRecipe}>Another</button>
            </div>
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
