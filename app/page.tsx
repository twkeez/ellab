"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TOOLS } from "@/lib/tools";
import Ring from "@/components/Ring";
import { countdown, goalProgress } from "@/lib/goals";
import { pad, ymd, habitStreak } from "@/lib/streak";
import { exerciseStats, DAILY_GOAL_MIN, WEEKLY_GOAL_DAYS, type Workout } from "@/lib/exercise";
import { isFavorite, whenLabel, DEFAULT_FAVORITES, type SportsData } from "@/lib/sports";
import { WxIcon, SunriseIcon, SunsetIcon, DropletIcon, aqiColor } from "@/components/WxIcons";

type Mode = "auto" | "morning" | "day" | "evening" | "night";
type Accent = "honey" | "green" | "teal" | "blue" | "purple" | "pink";
type MediaType = "book" | "film" | "music" | "game";

type Grocery = { id: number; text: string; done: boolean };
type Todo = { id: number; text: string; done: boolean };
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
type OtdItem = { year: number; text: string; link: string | null };

// Moon phase from date alone — no API needed.
const SYNODIC = 29.530588853;
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14);
const MOONS = [
  { glyph: "🌑", name: "new moon" },
  { glyph: "🌒", name: "waxing crescent" },
  { glyph: "🌓", name: "first quarter" },
  { glyph: "🌔", name: "waxing gibbous" },
  { glyph: "🌕", name: "full moon" },
  { glyph: "🌖", name: "waning gibbous" },
  { glyph: "🌗", name: "last quarter" },
  { glyph: "🌘", name: "waning crescent" },
];

function moonPhase(d: Date) {
  const days = (d.getTime() - NEW_MOON_2000) / 86400000;
  const frac = (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
  return MOONS[Math.round(frac * 8) % 8];
}
type Note = { id: number; text: string };
type Habit = { id: number; name: string; goal_id: number | null };
type SpotGoal = { id: number; title: string; why: string | null; target_date: string | null };
type SpotStep = { id: number; text: string; done: boolean };
type Chore = { id: number; name: string; last_done: string | null };
type NewsItem = { title: string; source: string; link: string };
type Ev = { id: number; title: string; time: string | null };
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
  chore: "chore", chores: "chore", clean: "chore",
  todo: "todo", todos: "todo", task: "todo", tasks: "todo",
  note: "note", idea: "note", thought: "note",
};

const DEST_LABEL: Record<string, string> = {
  book: "books", film: "films", music: "music", game: "games",
  groceries: "groceries", chore: "chores", todo: "to-dos", note: "notes",
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

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [accent, setAccent] = useState<Accent>("honey");

  const [wx, setWx] = useState<Wx | null>(null);
  const [wxError, setWxError] = useState(false);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [dismissals, setDismissals] = useState<Dismissal[]>([]);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [todayEvents, setTodayEvents] = useState<Ev[]>([]);
  const [latestDraft, setLatestDraft] = useState<{ title: string; words: number } | null>(null);
  const [otd, setOtd] = useState<OtdItem[]>([]);
  const [otdOffset, setOtdOffset] = useState(0);

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

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoInput, setTodoInput] = useState("");

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

  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitDates, setHabitDates] = useState<Record<number, string[]>>({});
  const [habitInput, setHabitInput] = useState("");

  const [spotGoal, setSpotGoal] = useState<SpotGoal | null>(null);
  const [spotSteps, setSpotSteps] = useState<SpotStep[]>([]);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sports, setSports] = useState<SportsData | null>(null);

  const [sparkIndex, setSparkIndex] = useState(0);

  const [remaining, setRemaining] = useState(0);
  const [timerTotal, setTimerTotal] = useState(0);
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

      const { data: td } = await supabase!
        .from("todos")
        .select("id,text,done")
        .order("created_at");
      if (alive && td) setTodos(td as Todo[]);

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

      const { data: hb } = await supabase!
        .from("habits")
        .select("id,name,goal_id")
        .order("created_at");
      if (alive && hb) setHabits(hb as Habit[]);

      const { data: hl } = await supabase!
        .from("habit_logs")
        .select("habit_id,date");
      if (alive && hl) {
        const map: Record<number, string[]> = {};
        for (const row of hl as { habit_id: number; date: string }[]) {
          (map[row.habit_id] ||= []).push(row.date);
        }
        setHabitDates(map);
      }

      const { data: gl } = await supabase!
        .from("goals")
        .select("id,title,why,target_date")
        .eq("done", false)
        .order("created_at")
        .limit(1);
      if (alive && gl && gl.length) {
        const g = gl[0] as SpotGoal;
        setSpotGoal(g);
        const { data: gsteps } = await supabase!
          .from("goal_steps")
          .select("id,text,done")
          .eq("goal_id", g.id)
          .order("created_at");
        if (alive && gsteps) setSpotSteps(gsteps as SpotStep[]);
      }

      const todayStr = ymd(new Date());
      const { data: ev } = await supabase!
        .from("events")
        .select("id,title,time")
        .eq("date", todayStr)
        .order("time", { ascending: true, nullsFirst: true });
      if (alive && ev) setTodayEvents(ev as Ev[]);

      const { data: wo } = await supabase!
        .from("workouts")
        .select("id,date,minutes")
        .order("date");
      if (alive && wo) setWorkouts(wo as Workout[]);

      const { data: dr } = await supabase!
        .from("drafts")
        .select("title,body")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (alive && dr && dr.length) {
        const d = dr[0] as { title: string; body: string };
        const w = d.body.trim() ? d.body.trim().split(/\s+/).length : 0;
        setLatestDraft({ title: d.title || "Untitled", words: w });
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/sports");
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setSports(d);
      } catch {
        // leave the sports tile in its loading state on failure
      }
    })();
    return () => { alive = false; };
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

  const saveRecipe = async () => {
    if (!recipe) return;
    if (!supabase) return;
    const { data: existing } = await supabase
      .from("recipes").select("id").eq("name", recipe.name).limit(1);
    if (existing && existing.length) {
      say("already in your recipes");
      return;
    }
    await supabase.from("recipes").insert({
      name: recipe.name,
      category: recipe.category,
      area: recipe.area,
      source: recipe.source,
    });
    say("saved to your recipes");
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/onthisday");
        if (!r.ok) return;
        const d = await r.json();
        if (alive && Array.isArray(d.items)) setOtd(d.items);
      } catch {
        // leave the tile empty on failure
      }
    })();
    return () => { alive = false; };
  }, []);

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

  const toggleGrocery = async (g: Grocery) => {
    const next = !g.done;
    setGroceries((gs) => gs.map((x) => (x.id === g.id ? { ...x, done: next } : x)));
    if (supabase) {
      await supabase.from("groceries").update({ done: next }).eq("id", g.id);
    }
  };

  const deleteGrocery = async (g: Grocery) => {
    setGroceries((gs) => gs.filter((x) => x.id !== g.id));
    if (supabase) await supabase.from("groceries").delete().eq("id", g.id);
  };

  const clearCheckedGroceries = async () => {
    const ids = groceries.filter((g) => g.done).map((g) => g.id);
    if (!ids.length) return;
    setGroceries((gs) => gs.filter((g) => !g.done));
    say(`cleared ${ids.length} item${ids.length > 1 ? "s" : ""}`);
    if (supabase) await supabase.from("groceries").delete().in("id", ids);
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

  const toggleTodo = async (t: Todo) => {
    const next = !t.done;
    setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    if (supabase) {
      await supabase.from("todos").update({ done: next }).eq("id", t.id);
    }
  };

  const deleteTodo = async (t: Todo) => {
    setTodos((ts) => ts.filter((x) => x.id !== t.id));
    if (supabase) await supabase.from("todos").delete().eq("id", t.id);
  };

  const clearDoneTodos = async () => {
    const ids = todos.filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    setTodos((ts) => ts.filter((t) => !t.done));
    say(`cleared ${ids.length} to-do${ids.length > 1 ? "s" : ""}`);
    if (supabase) await supabase.from("todos").delete().in("id", ids);
  };

  const addTodo = async () => {
    const v = todoInput.trim();
    if (!v) return;
    setTodoInput("");
    if (supabase) {
      const { data } = await supabase
        .from("todos").insert({ text: v, done: false }).select("id,text,done").single();
      if (data) setTodos((ts) => [...ts, data as Todo]);
    } else {
      setTodos((ts) => [...ts, { id: nextId.current++, text: v, done: false }]);
    }
    say("added to to-dos");
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
    } else if (dest === "todo") {
      if (supabase) {
        const { data } = await supabase
          .from("todos").insert({ text, done: false }).select("id,text,done").single();
        if (data) setTodos((ts) => [...ts, data as Todo]);
      } else {
        setTodos((ts) => [...ts, { id: nextId.current++, text, done: false }]);
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

  const toggleHabit = async (h: Habit) => {
    const today = ymd(new Date());
    const done = (habitDates[h.id] ?? []).includes(today);
    setHabitDates((m) => ({
      ...m,
      [h.id]: done
        ? (m[h.id] ?? []).filter((d) => d !== today)
        : [...(m[h.id] ?? []), today],
    }));
    if (supabase) {
      if (done) {
        await supabase.from("habit_logs").delete().eq("habit_id", h.id).eq("date", today);
      } else {
        await supabase.from("habit_logs").insert({ habit_id: h.id, date: today });
      }
    }
  };

  const addHabit = async () => {
    const v = habitInput.trim();
    if (!v) return;
    setHabitInput("");
    if (supabase) {
      const { data } = await supabase
        .from("habits").insert({ name: v }).select("id,name,goal_id").single();
      if (data) setHabits((h) => [...h, data as Habit]);
    } else {
      setHabits((h) => [...h, { id: nextId.current++, name: v, goal_id: null }]);
    }
    say("habit added");
  };

  const removeHabit = async (h: Habit) => {
    setHabits((hs) => hs.filter((x) => x.id !== h.id));
    setHabitDates((m) => { const n = { ...m }; delete n[h.id]; return n; });
    if (supabase) await supabase.from("habits").delete().eq("id", h.id);
  };

  const logRide = async (minutes: number) => {
    const day = ymd(new Date());
    if (supabase) {
      const { data } = await supabase
        .from("workouts").insert({ date: day, minutes }).select("id,date,minutes").single();
      if (data) setWorkouts((w) => [...w, data as Workout]);
    } else {
      setWorkouts((w) => [...w, { id: nextId.current++, date: day, minutes }]);
    }
    say(`logged ${minutes} min ride`);
  };

  const shuffleSpark = () => setSparkIndex((i) => (i + 1) % SPARKS.length);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const dismissNews = async (n: NewsItem) => {
    setDismissals((d) => [...d, { title: n.title, link: n.link, source: n.source }]);
    if (supabase) {
      await supabase
        .from("news_dismissals")
        .insert({ title: n.title, link: n.link, source: n.source });
    }
  };

  const fmtTimer = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

  const startTimer = (min: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (min === 0) {
      setRemaining(0);
      setTimerTotal(0);
      say("timer stopped");
      return;
    }
    setRemaining(min * 60);
    setTimerTotal(min * 60);
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

  const todayStr = ymd(now ?? new Date());
  const ex = exerciseStats(workouts, now ?? new Date());
  const sportsPick = useMemo(() => {
    if (!sports) return null;
    const ranked = sports.today
      .filter((g) => g.state !== "post")
      .map((g) => ({ g, s: g.score + (isFavorite(g, DEFAULT_FAVORITES) ? 6 : 0) }))
      .sort((a, b) => b.s - a.s);
    return { count: ranked.filter((x) => x.s >= 2).length, top: ranked[0]?.g ?? null };
  }, [sports]);
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
                    {now && (
                      <span className="wx-chip">
                        <span aria-hidden="true">{moonPhase(now).glyph}</span>
                        {moonPhase(now).name}
                      </span>
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
              <Link href="/today" className="searchpill" aria-label="Today's brief">
                ☀ Today
              </Link>
              <button
                className="searchpill"
                onClick={() => window.dispatchEvent(new Event("the-lab:search"))}
                aria-label="Search the lab"
              >
                Search <kbd>⌘K</kbd>
              </button>
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

        {spotGoal && (() => {
          const total = spotSteps.length;
          const done = spotSteps.filter((s) => s.done).length;
          const linked = habits.filter((h) => h.goal_id === spotGoal.id);
          const alive = linked.filter((h) => habitStreak(habitDates[h.id] ?? [], todayStr) > 0).length;
          const pct = goalProgress(done, total, alive, linked.length);
          const next = spotSteps.find((s) => !s.done);
          const cd = countdown(spotGoal.target_date);
          return (
            <Link href="/goals" className="spotlight" aria-label={"Open goal: " + spotGoal.title}>
              <Ring pct={pct} size={80} />
              <div className="spot-body">
                <p className="eyebrow"><span className="dot" /> the big goal</p>
                <h3 className="spot-title">{spotGoal.title}</h3>
                {spotGoal.why && <p className="spot-why">{spotGoal.why}</p>}
                <div className="spot-meta">
                  {next ? (
                    <span className="spot-next">Next · {next.text}</span>
                  ) : total > 0 ? (
                    <span className="spot-next">Every milestone done 🎉</span>
                  ) : (
                    <span className="spot-next">Break it into milestones →</span>
                  )}
                  {total > 0 && <span className="goal-count">{done}/{total} milestones</span>}
                  {linked.length > 0 && (
                    <span className={"goal-count" + (alive < linked.length ? " dim" : "")}>
                      🔥 {alive}/{linked.length} routine{alive < linked.length ? " — slipping" : ""}
                    </span>
                  )}
                  {cd && <span className={"goal-target " + cd.tone}>◷ {cd.text}</span>}
                </div>
              </div>
              <span className="spot-open">Open →</span>
            </Link>
          );
        })()}

        <main className="grid">
          <section className="tile c2 r2 notepad">
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
                <code className="pfx">game</code> <code className="pfx">todo</code> <code className="pfx">groceries</code>{" "}
                <code className="pfx">chore</code> — or a thought
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

          <section className="tile r2 caltile">
            <div className="caltop">
              <div className="datepad" aria-hidden="true">
                <span className="datepad-dow">{now ? DAYS[now.getDay()].slice(0, 3) : "—"}</span>
                <span className="datepad-num">{now ? now.getDate() : "–"}</span>
                <span className="datepad-mon">{now ? MONTHS[now.getMonth()].slice(0, 3) : ""}</span>
              </div>
              <p className="eyebrow"><span className="dot" /> today</p>
            </div>
            <ul className="list">
              {todayEvents.length === 0 ? (
                <li><span className="gtext" style={{ color: "var(--text-soft)" }}>nothing scheduled today</span></li>
              ) : (
                todayEvents.map((e) => (
                  <li key={e.id}>
                    <span className="ev-time">{e.time ? e.time : "—"}</span>
                    <span className="gtext">{e.title}</span>
                  </li>
                ))
              )}
            </ul>
            <span className="fill" />
            <Link href="/calendar" className="mini">Open calendar →</Link>
          </section>

          <section className="tile r2 receipt">
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
                  <button
                    className="row-x"
                    aria-label={"Remove " + g.text}
                    onClick={() => deleteGrocery(g)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {groceries.some((g) => g.done) && (
              <button className="clear-done" onClick={clearCheckedGroceries}>
                Clear {groceries.filter((g) => g.done).length} checked
              </button>
            )}
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

          <section className="tile c2 r2 feed">
            <div className="masthead">
              <p className="masthead-name">The Feed</p>
              <div className="masthead-line">
                <span>{dateStr || "Latest edition"}</span>
                <span>Pittsburgh · Books · Film</span>
              </div>
            </div>
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

          <section className="tile c2 r2 receipt">
            <p className="eyebrow"><span className="dot" /> to-do</p>
            <ul className="list">
              {[...todos].sort((a, b) => Number(a.done) - Number(b.done)).map((t) => (
                <li key={t.id} className={t.done ? "done" : ""}>
                  <button
                    className={"check" + (t.done ? " done" : "")}
                    aria-label={"Toggle " + t.text}
                    aria-pressed={t.done}
                    onClick={() => toggleTodo(t)}
                  >
                    {t.done ? "✓" : ""}
                  </button>
                  <span className="gtext">{t.text}</span>
                  <button
                    className="row-x"
                    aria-label={"Remove " + t.text}
                    onClick={() => deleteTodo(t)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <span className="fill" />
            {todos.some((t) => t.done) && (
              <button className="clear-done" onClick={clearDoneTodos}>
                Clear {todos.filter((t) => t.done).length} done
              </button>
            )}
            <div className="addrow">
              <input
                placeholder="add a to-do…"
                aria-label="Add a to-do"
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
              />
              <button className="iconbtn" aria-label="Add" onClick={addTodo}>+</button>
            </div>
          </section>

          <section className="tile c2 r2 otdtile">
            <p className="eyebrow"><span className="dot" /> on this day</p>
            <ul className="list otd">
              {otd.length === 0 ? (
                <li><span className="gtext" style={{ color: "var(--text-soft)" }}>digging through history…</span></li>
              ) : (
                [0, 1, 2].map((i) => {
                  const e = otd[(otdOffset + i) % otd.length];
                  return (
                    <li key={`${e.year}-${i}`}>
                      <span className="otd-year">{e.year}</span>
                      <span className="gtext">
                        {e.link ? (
                          <a href={e.link} target="_blank" rel="noopener noreferrer">{e.text}</a>
                        ) : (
                          e.text
                        )}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
            <span className="fill" />
            {otd.length > 3 && (
              <button className="mini" onClick={() => setOtdOffset((o) => (o + 3) % otd.length)}>
                More
              </button>
            )}
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

          <section className="tile biketile">
            <p className="eyebrow"><span className="dot" /> on the bike</p>
            <span className="fill" />
            <div className={"odo" + (ex.todayMin >= DAILY_GOAL_MIN ? " met" : "")} aria-label={`${ex.todayMin} minutes today`}>
              {String(Math.min(ex.todayMin, 999)).padStart(3, "0").split("").map((d, i) => (
                <span key={i} className="odo-cell">{d}</span>
              ))}
              <span className="odo-unit">min<br />today</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
              <span className="streak">🔥&#8202;<b>{ex.streak}</b>&#8202;day</span>
              <span className="bike-week">{ex.weekDaysHit}/{WEEKLY_GOAL_DAYS} this wk</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <button className="mini accent" style={{ marginTop: 0 }} onClick={() => logRide(DAILY_GOAL_MIN)}>Log {DAILY_GOAL_MIN}m</button>
              <Link href="/exercise" className="mini" style={{ marginTop: 0 }}>Details →</Link>
            </div>
          </section>

          <section className="tile r2">
            <p className="eyebrow"><span className="dot" /> habits</p>
            <ul className="list">
              {habits.length === 0 ? (
                <li><span className="gtext" style={{ color: "var(--text-soft)" }}>Build a daily habit — add one below.</span></li>
              ) : (
                habits.map((h) => {
                  const dates = habitDates[h.id] ?? [];
                  const done = dates.includes(todayStr);
                  const s = habitStreak(dates, todayStr);
                  return (
                    <li key={h.id} className={done ? "done" : ""}>
                      <button
                        className={"check" + (done ? " done" : "")}
                        aria-label={"Toggle " + h.name}
                        aria-pressed={done}
                        onClick={() => toggleHabit(h)}
                      >
                        {done ? "✓" : ""}
                      </button>
                      <span className="gtext">{h.name}</span>
                      {s > 0 && <span className="habit-streak">🔥{s}</span>}
                      <button
                        className="row-x"
                        aria-label={"Remove " + h.name}
                        onClick={() => removeHabit(h)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <span className="fill" />
            <div className="addrow">
              <input
                placeholder="add a habit…"
                aria-label="Add a habit"
                value={habitInput}
                onChange={(e) => setHabitInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addHabit(); }}
              />
              <button className="iconbtn" aria-label="Add" onClick={addHabit}>+</button>
            </div>
          </section>

          <section className="tile dinner recipecard">
            <p className="rc-kicker">Recipe · from the box</p>
            <div className="big recipe-name">
              {recipe ? recipe.name : "finding an idea…"}
            </div>
            {recipe && <p className="rc-meta">{recipe.area} · {recipe.category}</p>}
            <div className="dinner-actions">
              <button
                className="mini accent"
                style={{ marginTop: 0 }}
                onClick={() => recipe?.source && window.open(recipe.source, "_blank", "noopener,noreferrer")}
              >
                Cook it
              </button>
              <button className="mini" style={{ marginTop: 0 }} onClick={saveRecipe}>Save</button>
              <button className="mini" style={{ marginTop: 0 }} onClick={loadRecipe}>Another</button>
            </div>
          </section>

          <section className="tile">
            <p className="eyebrow"><span className="dot" /> random spark</p>
            <p className="note" style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{SPARKS[sparkIndex]}</p>
            <button className="mini" onClick={shuffleSpark}>Shuffle</button>
          </section>

          <section className="tile timertile">
            <p className="eyebrow"><span className="dot" /> timer</p>
            <span className="fill" />
            <div className="dial">
              <svg viewBox="0 0 120 120" className="dial-svg" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i / 12) * 2 * Math.PI;
                  const r1 = i % 3 === 0 ? 46 : 50;
                  const sin = Math.sin(a), cos = Math.cos(a);
                  return (
                    <line
                      key={i}
                      className={"dial-tick" + (i % 3 === 0 ? " major" : "")}
                      x1={(60 + r1 * sin).toFixed(3)} y1={(60 - r1 * cos).toFixed(3)}
                      x2={(60 + 55 * sin).toFixed(3)} y2={(60 - 55 * cos).toFixed(3)}
                    />
                  );
                })}
                <circle className="dial-track" cx="60" cy="60" r="52" />
                {timerTotal > 0 && (
                  <circle
                    className="dial-arc" cx="60" cy="60" r="52" transform="rotate(-90 60 60)"
                    style={{ strokeDasharray: 2 * Math.PI * 52, strokeDashoffset: 2 * Math.PI * 52 * (1 - remaining / timerTotal) }}
                  />
                )}
              </svg>
              <div className="timer-num">{fmtTimer(remaining)}</div>
            </div>
            <div className="presets">
              <button className="preset" onClick={() => startTimer(5)}>5m</button>
              <button className="preset" onClick={() => startTimer(10)}>10m</button>
              <button className="preset" onClick={() => startTimer(15)}>15m</button>
              <button className="preset" onClick={() => startTimer(0)}>stop</button>
            </div>
          </section>

          <section className="tile">
            <p className="eyebrow"><span className="dot" /> tonight&apos;s sports</p>
            <span className="fill" />
            {sportsPick?.top ? (
              <>
                <div className="focus-big" style={{ fontSize: "1.15rem" }}>
                  {sportsPick.top.away.short} <span style={{ color: "var(--text-faint)" }}>@</span> {sportsPick.top.home.short}
                </div>
                <p className="note" style={{ marginTop: 2 }}>
                  {whenLabel(sportsPick.top, now ? now.getTime() : Date.now())}
                  {(() => {
                    const tv = sportsPick.top.broadcasts.find((b) => !/\.tv$/i.test(b)) ?? sportsPick.top.broadcasts[0];
                    return tv ? ` · ${tv}` : "";
                  })()}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                  <span className="bike-week">{sportsPick.count} worth watching</span>
                  <Link href="/sports" className="mini" style={{ marginTop: 0 }}>All →</Link>
                </div>
              </>
            ) : (
              <>
                <div className="focus-big" style={{ fontSize: "1.1rem", color: "var(--text-soft)" }}>Checking the slate…</div>
                <Link href="/sports" className="mini">Open sports →</Link>
              </>
            )}
          </section>

          <section className="tile c2 studio">
            <p className="eyebrow"><span className="dot" /> writing studio · ai</p>
            <span className="fill" />
            <div className="draft">
              {latestDraft ? `“${latestDraft.title}” — ${latestDraft.words} words` : "Nothing started yet"}
            </div>
            <p className="note">fiction &amp; creative · Claude helps you develop it</p>
            <div className="row">
              <Link href="/write" className="mini accent" style={{ marginTop: 0 }}>
                {latestDraft ? "Resume writing" : "Start writing"}
              </Link>
              <Link href="/write" className="mini" style={{ marginTop: 0 }}>New idea</Link>
            </div>
          </section>

          <section className="tile c2 tools">
            <p className="eyebrow" style={{ width: "100%" }}><span className="dot" /> jump into</p>
            <Link href="/recap" className="toolbtn">This week</Link>
            <Link href="/sports" className="toolbtn">Sports</Link>
            <Link href="/exercise" className="toolbtn">On the bike</Link>
            <Link href="/goals" className="toolbtn">Goals</Link>
            <Link href="/recipes" className="toolbtn">Recipes</Link>
            <Link href="/chores" className="toolbtn">All chores</Link>
            <Link href="/calendar" className="toolbtn">Calendar</Link>
            <Link href="/experiments" className="toolbtn">Experiments <span className="k">{TOOLS.length}</span></Link>
          </section>
        </main>
      </div>

      <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
