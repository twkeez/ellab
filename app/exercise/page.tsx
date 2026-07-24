"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Ring from "@/components/Ring";
import { ymd } from "@/lib/streak";
import { exerciseStats, DAILY_GOAL_MIN, WEEKLY_GOAL_DAYS, type Workout } from "@/lib/exercise";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const QUICK = [15, 30, 45, 60];

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function ExercisePage() {
  const [tod, setTod] = useState("day");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [custom, setCustom] = useState("");

  const today = new Date();
  const todayStr = ymd(today);

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!.from("workouts").select("id,date,minutes").order("date");
      if (alive && data) setWorkouts(data as Workout[]);
    })();
    return () => { alive = false; };
  }, []);

  const logRide = async (minutes: number) => {
    if (!minutes || minutes <= 0) return;
    if (supabase) {
      const { data } = await supabase
        .from("workouts").insert({ date: todayStr, minutes }).select("id,date,minutes").single();
      if (data) setWorkouts((w) => [...w, data as Workout]);
    } else {
      setWorkouts((w) => [...w, { id: Date.now(), date: todayStr, minutes }]);
    }
  };

  const removeWorkout = async (id: number) => {
    setWorkouts((w) => w.filter((x) => x.id !== id));
    if (supabase) await supabase.from("workouts").delete().eq("id", id);
  };

  const addCustom = () => {
    const n = parseInt(custom, 10);
    if (!isNaN(n) && n > 0) { logRide(n); setCustom(""); }
  };

  const stats = exerciseStats(workouts, today);
  const todaySessions = workouts.filter((w) => w.date === todayStr);
  const dayPct = Math.min(stats.todayMin / DAILY_GOAL_MIN, 1);

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 720 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> exercise</p>
            <h1 className="studio-h1">On the bike</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile">
          <p className="eyebrow"><span className="dot" /> today</p>
          <div className="ex-today">
            <Ring pct={dayPct} size={92} />
            <div className="ex-today-body">
              <div className="ex-today-num">
                {stats.todayMin} <span>/ {DAILY_GOAL_MIN} min</span>
              </div>
              <p className="note" style={{ marginTop: 2 }}>
                {stats.todayMin >= DAILY_GOAL_MIN
                  ? "Goal met for today — nice riding. 🚴"
                  : stats.todayMin > 0
                  ? `${DAILY_GOAL_MIN - stats.todayMin} min to hit today's goal.`
                  : "Hop on when you're ready."}
              </p>
              {todaySessions.length > 0 && (
                <div className="ex-sessions">
                  {todaySessions.map((s) => (
                    <span key={s.id} className="ex-chip">
                      {s.minutes} min
                      <button className="ex-chip-x" aria-label="Remove this ride" onClick={() => removeWorkout(s.id)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ex-log">
            {QUICK.map((m) => (
              <button key={m} className="ex-quick" onClick={() => logRide(m)}>+{m} min</button>
            ))}
            <div className="ex-custom">
              <input
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="min"
                aria-label="Custom minutes"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
              />
              <button className="iconbtn" aria-label="Log ride" onClick={addCustom}>+</button>
            </div>
          </div>
        </section>

        <section className="tile" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <p className="eyebrow"><span className="dot" /> this week</p>
            <span className="streak">🔥&#8202;<b>{stats.streak}</b>&#8202;day streak</span>
          </div>

          <div className="ex-week">
            <div className="week-dots">
              {stats.week.map((d, i) => (
                <span
                  key={d.date}
                  className={"wd" + (d.hit ? " on" : d.minutes > 0 ? " part" : "") + (d.date === todayStr ? " today" : "") + (d.date > todayStr ? " future" : "")}
                  title={d.minutes > 0 ? `${d.minutes} min` : "no ride"}
                >
                  {DOW[i]}
                </span>
              ))}
            </div>
            <div className="ex-week-stats">
              <span className={"ex-stat" + (stats.weekDaysHit >= WEEKLY_GOAL_DAYS ? " met" : "")}>
                <b>{stats.weekDaysHit}</b>/{WEEKLY_GOAL_DAYS} days
              </span>
              <span className="ex-stat"><b>{stats.weekMinutes}</b> min</span>
            </div>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            {stats.weekDaysHit >= WEEKLY_GOAL_DAYS
              ? "Weekly goal complete. That's the week won. 🎉"
              : `${WEEKLY_GOAL_DAYS - stats.weekDaysHit} more ${WEEKLY_GOAL_DAYS - stats.weekDaysHit === 1 ? "day" : "days"} to hit ${WEEKLY_GOAL_DAYS} this week.`}
          </p>
        </section>
      </div>
    </div>
  );
}
