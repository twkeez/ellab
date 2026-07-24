"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ymd, habitStreak } from "@/lib/streak";
import { exerciseStats, DAILY_GOAL_MIN, WEEKLY_GOAL_DAYS, type Workout } from "@/lib/exercise";

type Ev = { id: number; title: string; time: string | null };
type Chore = { id: number; name: string; last_done: string | null };
type Habit = { id: number; name: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function todOf(h: number): "morning" | "day" | "evening" | "night" {
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}
function greet(t: string): string {
  return { morning: "Good morning, Tom", day: "Hello, Tom", evening: "Good evening, Tom", night: "Still up, Tom" }[t] ?? "Hello, Tom";
}
function sortChores(a: Chore, b: Chore): number {
  if (a.last_done === b.last_done) return a.id - b.id;
  if (a.last_done === null) return -1;
  if (b.last_done === null) return 1;
  return a.last_done < b.last_done ? -1 : 1;
}

export default function TodayPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [wx, setWx] = useState<{ tempF: number; label: string; city: string; rainLine: string } | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastDoneDate, setLastDoneDate] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitDates, setHabitDates] = useState<Record<number, string[]>>({});
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [headline, setHeadline] = useState<{ title: string; source: string; link: string } | null>(null);
  const [otd, setOtd] = useState<{ year: number; text: string } | null>(null);
  const [intention, setIntention] = useState("");
  const [intentionSaved, setIntentionSaved] = useState(false);

  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);

  const todayStr = ymd(now ?? new Date());

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/weather");
        if (r.ok) setWx(await r.json());
      } catch {}
      try {
        const r = await fetch("/api/news");
        if (r.ok) { const d = await r.json(); if (Array.isArray(d.items) && d.items.length) setHeadline(d.items[0]); }
      } catch {}
      try {
        const r = await fetch("/api/onthisday");
        if (r.ok) { const d = await r.json(); if (Array.isArray(d.items) && d.items.length) setOtd(d.items[0]); }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const t = ymd(new Date());
    (async () => {
      const { data: ev } = await supabase!.from("events").select("id,title,time").eq("date", t).order("time", { ascending: true, nullsFirst: true });
      if (alive && ev) setEvents(ev as Ev[]);

      const { data: c } = await supabase!.from("chores").select("id,name,last_done").order("last_done", { ascending: true, nullsFirst: true }).order("created_at");
      if (alive && c) setChores(c as Chore[]);

      const { data: m } = await supabase!.from("app_meta").select("streak,last_done_date").eq("id", 1).single();
      if (alive && m) { setStreak(m.streak ?? 0); setLastDoneDate(m.last_done_date ?? null); }

      const { data: hb } = await supabase!.from("habits").select("id,name").order("created_at");
      if (alive && hb) setHabits(hb as Habit[]);

      const { data: hl } = await supabase!.from("habit_logs").select("habit_id,date");
      if (alive && hl) {
        const map: Record<number, string[]> = {};
        for (const row of hl as { habit_id: number; date: string }[]) (map[row.habit_id] ||= []).push(row.date);
        setHabitDates(map);
      }

      const { data: wo } = await supabase!.from("workouts").select("id,date,minutes");
      if (alive && wo) setWorkouts(wo as Workout[]);

      const { data: dl } = await supabase!.from("daily").select("intention").eq("date", t).single();
      if (alive && dl?.intention) { setIntention(dl.intention); setIntentionSaved(true); }
    })();
    return () => { alive = false; };
  }, []);

  const saveIntention = async () => {
    const v = intention.trim();
    setIntentionSaved(true);
    if (supabase) await supabase.from("daily").upsert({ date: todayStr, intention: v }, { onConflict: "date" });
  };

  const focus = chores[0];
  const completeFocus = async () => {
    if (!focus) return;
    const d = new Date();
    const today = ymd(d);
    const yesterday = ymd(new Date(d.getTime() - 86400000));
    const newStreak = lastDoneDate === today ? streak || 1 : lastDoneDate === yesterday ? streak + 1 : 1;
    const iso = d.toISOString();
    setChores((cs) => [...cs.map((c) => (c.id === focus.id ? { ...c, last_done: iso } : c))].sort(sortChores));
    setStreak(newStreak);
    setLastDoneDate(today);
    if (supabase) {
      await supabase.from("chores").update({ last_done: iso }).eq("id", focus.id);
      await supabase.from("app_meta").update({ streak: newStreak, last_done_date: today }).eq("id", 1);
    }
  };

  const toggleHabit = async (h: Habit) => {
    const done = (habitDates[h.id] ?? []).includes(todayStr);
    setHabitDates((m) => ({ ...m, [h.id]: done ? (m[h.id] ?? []).filter((x) => x !== todayStr) : [...(m[h.id] ?? []), todayStr] }));
    if (supabase) {
      if (done) await supabase.from("habit_logs").delete().eq("habit_id", h.id).eq("date", todayStr);
      else await supabase.from("habit_logs").insert({ habit_id: h.id, date: todayStr });
    }
  };

  const logRide = async (minutes: number) => {
    if (supabase) {
      const { data } = await supabase.from("workouts").insert({ date: todayStr, minutes }).select("id,date,minutes").single();
      if (data) setWorkouts((w) => [...w, data as Workout]);
    } else {
      setWorkouts((w) => [...w, { id: Date.now(), date: todayStr, minutes }]);
    }
  };

  const tod = now ? todOf(now.getHours()) : "morning";
  const timeStr = now ? `${(now.getHours() % 12) || 12}:${String(now.getMinutes()).padStart(2, "0")} ${now.getHours() < 12 ? "am" : "pm"}` : "";
  const dateStr = now ? `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}` : "";
  const ex = exerciseStats(workouts, now ?? new Date());

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>

      <div className="brief-wrap">
        <header className="brief-hero">
          <p className="brief-dateline">{dateStr}{timeStr ? ` · ${timeStr}` : ""}</p>
          <h1 className="brief-greet">{greet(tod)}</h1>
          {wx && <p className="brief-weather">{wx.tempF}° · {wx.label} in {wx.city} · {wx.rainLine.startsWith("no rain") ? "no rain today" : wx.rainLine}</p>}
        </header>

        <section className="brief-block brief-intention">
          <p className="brief-label">Today&apos;s intention</p>
          <input
            className="brief-intention-input"
            placeholder="What would make today good?"
            value={intention}
            onChange={(e) => { setIntention(e.target.value); setIntentionSaved(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { saveIntention(); (e.target as HTMLInputElement).blur(); } }}
            onBlur={saveIntention}
          />
          {intentionSaved && intention.trim() && <span className="brief-saved">saved ✓</span>}
        </section>

        <section className="brief-block">
          <p className="brief-label">On the agenda</p>
          {events.length === 0 ? (
            <p className="brief-empty">Nothing scheduled — the day is yours.</p>
          ) : (
            <ul className="brief-list">
              {events.map((e) => (
                <li key={e.id}><span className="brief-time">{e.time || "—"}</span><span>{e.title}</span></li>
              ))}
            </ul>
          )}
        </section>

        {focus && (
          <section className="brief-block brief-focus">
            <div>
              <p className="brief-label">Today&apos;s focus · 🔥 {streak} day streak</p>
              <p className="brief-focus-name">{focus.name}</p>
            </div>
            <button className="mini accent" style={{ marginTop: 0 }} onClick={completeFocus}>Done</button>
          </section>
        )}

        {habits.length > 0 && (
          <section className="brief-block">
            <p className="brief-label">Habits</p>
            <div className="brief-habits">
              {habits.map((h) => {
                const done = (habitDates[h.id] ?? []).includes(todayStr);
                const s = habitStreak(habitDates[h.id] ?? [], todayStr);
                return (
                  <button key={h.id} className={"brief-habit" + (done ? " done" : "")} onClick={() => toggleHabit(h)}>
                    <span className={"check" + (done ? " done" : "")}>{done ? "✓" : ""}</span>
                    <span className="brief-habit-name">{h.name}</span>
                    {s > 0 && <span className="habit-streak">🔥{s}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="brief-block brief-focus">
          <div>
            <p className="brief-label">On the bike</p>
            <p className="brief-focus-name">
              {ex.todayMin >= DAILY_GOAL_MIN ? `${ex.todayMin} min done ✓` : `${ex.todayMin} / ${DAILY_GOAL_MIN} min`}
              <span className="brief-sub"> · {ex.weekDaysHit}/{WEEKLY_GOAL_DAYS} this week</span>
            </p>
          </div>
          {ex.todayMin < DAILY_GOAL_MIN && (
            <button className="mini accent" style={{ marginTop: 0 }} onClick={() => logRide(DAILY_GOAL_MIN)}>Log {DAILY_GOAL_MIN}m</button>
          )}
        </section>

        {(headline || otd) && (
          <section className="brief-block">
            <p className="brief-label">A glance at the world</p>
            {headline && (
              <a className="brief-headline" href={headline.link} target="_blank" rel="noopener noreferrer">
                <span className="brief-src">{headline.source}</span>{headline.title}
              </a>
            )}
            {otd && <p className="brief-otd"><b>{otd.year}</b> — {otd.text}</p>}
          </section>
        )}

        <footer className="brief-foot">
          <Link href="/" className="brief-enter">Enter the lab →</Link>
        </footer>
      </div>
    </div>
  );
}
