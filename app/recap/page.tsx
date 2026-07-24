"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Ring from "@/components/Ring";
import { goalProgress } from "@/lib/goals";
import { ymd, habitStreak } from "@/lib/streak";

type Goal = { id: number; title: string; target_date: string | null };
type Step = { id: number; goal_id: number; done: boolean; done_at: string | null };
type Habit = { id: number; name: string; goal_id: number | null };
type Chore = { id: number; name: string; last_done: string | null };

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// Monday→Sunday of the week containing `today`, as ymd strings.
function weekDates(today: Date): string[] {
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) =>
    ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
  );
}

function momentumLine(wins: number): string {
  if (wins === 0) return "A fresh week. One small win gets it rolling.";
  if (wins < 5) return "It's adding up — keep the thread going.";
  if (wins < 15) return "Strong week. This is what momentum feels like.";
  return "You're on fire. Look at everything you moved.";
}

export default function RecapPage() {
  const [tod, setTod] = useState("day");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitDates, setHabitDates] = useState<Record<number, string[]>>({});
  const [chores, setChores] = useState<Chore[]>([]);

  const today = new Date();
  const todayStr = ymd(today);
  const week = weekDates(today);
  const weekStartIso = new Date(week[0] + "T00:00:00").toISOString();
  const rangeLabel = (() => {
    const a = new Date(week[0] + "T00:00:00");
    const b = new Date(week[6] + "T00:00:00");
    const sameMonth = a.getMonth() === b.getMonth();
    return sameMonth
      ? `${MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`
      : `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}`;
  })();

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data: g } = await supabase!.from("goals").select("id,title,target_date").eq("done", false).order("created_at");
      if (alive && g) setGoals(g as Goal[]);

      const { data: s } = await supabase!.from("goal_steps").select("id,goal_id,done,done_at");
      if (alive && s) setSteps(s as Step[]);

      const { data: hb } = await supabase!.from("habits").select("id,name,goal_id").order("created_at");
      if (alive && hb) setHabits(hb as Habit[]);

      const { data: hl } = await supabase!.from("habit_logs").select("habit_id,date");
      if (alive && hl) {
        const map: Record<number, string[]> = {};
        for (const row of hl as { habit_id: number; date: string }[]) {
          (map[row.habit_id] ||= []).push(row.date);
        }
        setHabitDates(map);
      }

      const { data: c } = await supabase!.from("chores").select("id,name,last_done");
      if (alive && c) setChores(c as Chore[]);
    })();
    return () => { alive = false; };
  }, []);

  const habitTicks = habits.reduce(
    (sum, h) => sum + week.filter((d) => (habitDates[h.id] ?? []).includes(d)).length,
    0
  );
  const milestonesCleared = steps.filter((s) => s.done && s.done_at && s.done_at >= weekStartIso).length;
  const choresThisWeek = chores.filter((c) => c.last_done && c.last_done >= weekStartIso);
  const wins = habitTicks + milestonesCleared + choresThisWeek.length;

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 820 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> this week · {rangeLabel}</p>
            <h1 className="studio-h1">Momentum</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile recap-headline">
          <div className="recap-big">{wins}</div>
          <div>
            <p className="recap-big-label">win{wins === 1 ? "" : "s"} this week</p>
            <p className="note" style={{ marginTop: 4 }}>{momentumLine(wins)}</p>
            <p className="recap-breakdown">
              {habitTicks} habit tick{habitTicks === 1 ? "" : "s"} · {milestonesCleared} milestone{milestonesCleared === 1 ? "" : "s"} · {choresThisWeek.length} chore{choresThisWeek.length === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> daily habits</p>
          {habits.length === 0 ? (
            <p className="gtext" style={{ color: "var(--text-soft)", marginTop: 8 }}>No habits yet — add one on the hub to start a streak.</p>
          ) : (
            <div className="recap-habits">
              {habits.map((h) => {
                const dates = habitDates[h.id] ?? [];
                const s = habitStreak(dates, todayStr);
                return (
                  <div className="recap-habit" key={h.id}>
                    <span className="recap-habit-name">{h.name}</span>
                    <div className="week-dots" role="img" aria-label={`${h.name}: ${week.filter((d) => dates.includes(d)).length} of 7 days`}>
                      {week.map((d, i) => (
                        <span
                          key={d}
                          className={"wd" + (dates.includes(d) ? " on" : "") + (d === todayStr ? " today" : "") + (d > todayStr ? " future" : "")}
                        >
                          {DOW[i]}
                        </span>
                      ))}
                    </div>
                    <span className={"habit-streak" + (s > 0 ? "" : " cold")}>🔥{s}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {goals.length > 0 && (
          <section className="tile" style={{ marginTop: 16 }}>
            <p className="eyebrow"><span className="dot" /> goals</p>
            <div className="recap-goals">
              {goals.map((g) => {
                const gs = steps.filter((s) => s.goal_id === g.id);
                const total = gs.length;
                const done = gs.filter((s) => s.done).length;
                const linked = habits.filter((h) => h.goal_id === g.id);
                const alive = linked.filter((h) => habitStreak(habitDates[h.id] ?? [], todayStr) > 0).length;
                const pct = goalProgress(done, total, alive, linked.length);
                const clearedHere = gs.filter((s) => s.done && s.done_at && s.done_at >= weekStartIso).length;
                return (
                  <Link href="/goals" className="recap-goal" key={g.id}>
                    <Ring pct={pct} size={56} />
                    <div style={{ minWidth: 0 }}>
                      <span className="recap-goal-title">{g.title}</span>
                      <p className="recap-breakdown" style={{ marginTop: 3 }}>
                        {clearedHere > 0 ? `${clearedHere} cleared this week · ` : ""}{done}/{total} milestones{linked.length > 0 ? ` · ${alive}/${linked.length} routine` : ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {choresThisWeek.length > 0 && (
          <section className="tile" style={{ marginTop: 16 }}>
            <p className="eyebrow"><span className="dot" /> around the house</p>
            <p className="note" style={{ marginTop: 8, color: "var(--text)" }}>
              {choresThisWeek.length} chore{choresThisWeek.length === 1 ? "" : "s"} handled: {choresThisWeek.map((c) => c.name).join(" · ")}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
