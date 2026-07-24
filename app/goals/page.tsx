"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Ring from "@/components/Ring";
import { countdown, goalProgress } from "@/lib/goals";
import { ymd, habitStreak } from "@/lib/streak";

type Goal = { id: number; title: string; why: string | null; done: boolean; target_date: string | null };
type Step = { id: number; goal_id: number; text: string; done: boolean };
type Habit = { id: number; name: string; goal_id: number | null };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function GoalsPage() {
  const [tod, setTod] = useState("day");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [stepInputs, setStepInputs] = useState<Record<number, string>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitDates, setHabitDates] = useState<Record<number, string[]>>({});
  const [habitInputs, setHabitInputs] = useState<Record<number, string>>({});

  const todayStr = ymd(new Date());

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data: g } = await supabase!
        .from("goals")
        .select("id,title,why,done,target_date")
        .order("created_at");
      if (alive && g) setGoals(g as Goal[]);

      const { data: s } = await supabase!
        .from("goal_steps")
        .select("id,goal_id,text,done")
        .order("created_at");
      if (alive && s) setSteps(s as Step[]);

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
    })();
    return () => { alive = false; };
  }, []);

  const addGoal = async () => {
    const t = title.trim();
    if (!t) return;
    const w = why.trim() || null;
    setTitle("");
    setWhy("");
    if (supabase) {
      const { data } = await supabase
        .from("goals")
        .insert({ title: t, why: w, done: false })
        .select("id,title,why,done,target_date")
        .single();
      if (data) setGoals((g) => [...g, data as Goal]);
    }
  };

  const setDone = async (g: Goal, done: boolean) => {
    setGoals((gs) => gs.map((x) => (x.id === g.id ? { ...x, done } : x)));
    if (supabase) await supabase.from("goals").update({ done }).eq("id", g.id);
  };

  const setTarget = async (g: Goal, date: string | null) => {
    setGoals((gs) => gs.map((x) => (x.id === g.id ? { ...x, target_date: date } : x)));
    if (supabase) await supabase.from("goals").update({ target_date: date }).eq("id", g.id);
  };

  const removeGoal = async (g: Goal) => {
    setGoals((gs) => gs.filter((x) => x.id !== g.id));
    setSteps((ss) => ss.filter((x) => x.goal_id !== g.id));
    if (supabase) await supabase.from("goals").delete().eq("id", g.id);
  };

  const addStep = async (g: Goal) => {
    const v = (stepInputs[g.id] ?? "").trim();
    if (!v) return;
    setStepInputs((m) => ({ ...m, [g.id]: "" }));
    if (supabase) {
      const { data } = await supabase
        .from("goal_steps")
        .insert({ goal_id: g.id, text: v, done: false })
        .select("id,goal_id,text,done")
        .single();
      if (data) setSteps((s) => [...s, data as Step]);
    }
  };

  const toggleStep = async (s: Step) => {
    const next = !s.done;
    setSteps((ss) => ss.map((x) => (x.id === s.id ? { ...x, done: next } : x)));
    if (supabase) await supabase.from("goal_steps").update({ done: next }).eq("id", s.id);
  };

  const removeStep = async (s: Step) => {
    setSteps((ss) => ss.filter((x) => x.id !== s.id));
    if (supabase) await supabase.from("goal_steps").delete().eq("id", s.id);
  };

  const toggleHabitToday = async (h: Habit) => {
    const done = (habitDates[h.id] ?? []).includes(todayStr);
    setHabitDates((m) => ({
      ...m,
      [h.id]: done
        ? (m[h.id] ?? []).filter((d) => d !== todayStr)
        : [...(m[h.id] ?? []), todayStr],
    }));
    if (supabase) {
      if (done) {
        await supabase.from("habit_logs").delete().eq("habit_id", h.id).eq("date", todayStr);
      } else {
        await supabase.from("habit_logs").insert({ habit_id: h.id, date: todayStr });
      }
    }
  };

  const addLinkedHabit = async (g: Goal) => {
    const v = (habitInputs[g.id] ?? "").trim();
    if (!v) return;
    setHabitInputs((m) => ({ ...m, [g.id]: "" }));
    if (supabase) {
      const { data } = await supabase
        .from("habits")
        .insert({ name: v, goal_id: g.id })
        .select("id,name,goal_id")
        .single();
      if (data) setHabits((h) => [...h, data as Habit]);
    }
  };

  const linkHabit = async (g: Goal, habitId: number) => {
    setHabits((hs) => hs.map((x) => (x.id === habitId ? { ...x, goal_id: g.id } : x)));
    if (supabase) await supabase.from("habits").update({ goal_id: g.id }).eq("id", habitId);
  };

  const unlinkHabit = async (h: Habit) => {
    setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, goal_id: null } : x)));
    if (supabase) await supabase.from("habits").update({ goal_id: null }).eq("id", h.id);
  };

  const active = goals.filter((g) => !g.done);
  const unlinkedHabits = habits.filter((h) => h.goal_id == null);
  const achieved = goals.filter((g) => g.done);

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 760 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> goals</p>
            <h1 className="studio-h1">What I&apos;m chasing</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile">
          <p className="eyebrow"><span className="dot" /> chasing · {active.length}</p>

          {active.length === 0 ? (
            <p className="gtext" style={{ color: "var(--text-soft)", marginTop: 10 }}>
              Name something bigger you&apos;re working toward — add it below, then break it into milestones.
            </p>
          ) : (
            <div className="goal-list">
              {active.map((g) => {
                const gs = steps.filter((s) => s.goal_id === g.id);
                const total = gs.length;
                const done = gs.filter((s) => s.done).length;
                const linked = habits.filter((h) => h.goal_id === g.id);
                const aliveCount = linked.filter((h) => habitStreak(habitDates[h.id] ?? [], todayStr) > 0).length;
                const pct = goalProgress(done, total, aliveCount, linked.length);
                const cd = countdown(g.target_date);
                const complete = total > 0 && done === total;
                return (
                  <div className="goal-card" key={g.id}>
                    <Ring pct={pct} />
                    <div className="goal-body">
                      <div className="goal-head">
                        <div style={{ minWidth: 0 }}>
                          <h3 className="goal-title">{g.title}</h3>
                          {g.why && <p className="goal-why">{g.why}</p>}
                        </div>
                        <button className="row-x" aria-label={"Remove " + g.title} onClick={() => removeGoal(g)}>×</button>
                      </div>

                      <div className="goal-meta">
                        {cd && <span className={"goal-target " + cd.tone}>◷ {cd.text}</span>}
                        {total > 0 && <span className="goal-count">{done}/{total} milestones</span>}
                        <input
                          type="date"
                          className="goal-dateinput"
                          aria-label="Target date"
                          value={g.target_date ?? ""}
                          onChange={(e) => setTarget(g, e.target.value || null)}
                        />
                      </div>

                      {total > 0 && (
                        <ul className="goal-steps">
                          {gs.map((s) => (
                            <li key={s.id} className={s.done ? "done" : ""}>
                              <button
                                className={"check" + (s.done ? " done" : "")}
                                aria-label={"Toggle " + s.text}
                                aria-pressed={s.done}
                                onClick={() => toggleStep(s)}
                              >
                                {s.done ? "✓" : ""}
                              </button>
                              <span className="gtext">{s.text}</span>
                              <button className="row-x" aria-label={"Remove " + s.text} onClick={() => removeStep(s)}>×</button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="step-add">
                        <input
                          placeholder="add a milestone…"
                          aria-label="Add a milestone"
                          value={stepInputs[g.id] ?? ""}
                          onChange={(e) => setStepInputs((m) => ({ ...m, [g.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") addStep(g); }}
                        />
                        <button className="iconbtn" aria-label="Add milestone" onClick={() => addStep(g)}>+</button>
                      </div>

                      <div className="goal-routine">
                        <p className="routine-label">Daily routine that keeps this going</p>
                        {linked.map((h) => {
                          const dates = habitDates[h.id] ?? [];
                          const hdone = dates.includes(todayStr);
                          const s = habitStreak(dates, todayStr);
                          return (
                            <div key={h.id} className={"ghabit" + (hdone ? " done" : "")}>
                              <button
                                className={"check" + (hdone ? " done" : "")}
                                aria-label={"Tick " + h.name + " today"}
                                aria-pressed={hdone}
                                onClick={() => toggleHabitToday(h)}
                              >
                                {hdone ? "✓" : ""}
                              </button>
                              <span className="gtext">{h.name}</span>
                              <span className={"habit-streak" + (s > 0 ? "" : " cold")}>🔥{s}</span>
                              <button className="row-x" aria-label={"Unlink " + h.name} title="Unlink from this goal" onClick={() => unlinkHabit(h)}>×</button>
                            </div>
                          );
                        })}
                        <div className="step-add">
                          <input
                            placeholder="add a daily habit that gets you here…"
                            aria-label="Add a daily habit for this goal"
                            value={habitInputs[g.id] ?? ""}
                            onChange={(e) => setHabitInputs((m) => ({ ...m, [g.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") addLinkedHabit(g); }}
                          />
                          <button className="iconbtn" aria-label="Add daily habit" onClick={() => addLinkedHabit(g)}>+</button>
                        </div>
                        {unlinkedHabits.length > 0 && (
                          <select
                            className="habit-link-select"
                            aria-label="Link an existing habit"
                            value=""
                            onChange={(e) => { if (e.target.value) linkHabit(g, Number(e.target.value)); }}
                          >
                            <option value="">or link an existing habit…</option>
                            {unlinkedHabits.map((h) => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {complete && (
                        <button className="mini accent goal-achieve" style={{ marginTop: 0 }} onClick={() => setDone(g, true)}>
                          🎉 Every milestone done — mark achieved
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="goal-add">
            <input
              placeholder="a goal — e.g. finish the novel draft"
              aria-label="Goal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("goal-why")?.focus(); }}
            />
            <input
              id="goal-why"
              placeholder="why it matters (optional)"
              aria-label="Why this goal matters"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }}
            />
            <button className="mini accent" style={{ marginTop: 0 }} onClick={addGoal}>Add goal</button>
          </div>
        </section>

        {achieved.length > 0 && (
          <section className="tile" style={{ marginTop: 16 }}>
            <p className="eyebrow"><span className="dot" /> achieved · {achieved.length}</p>
            <ul className="list goals">
              {achieved.map((g) => (
                <li key={g.id}>
                  <button className="check done" aria-label={"Reopen " + g.title} title="Reopen" onClick={() => setDone(g, false)}>✓</button>
                  <span className="gtext" style={{ color: "var(--text-soft)", textDecoration: "line-through" }}>{g.title}</span>
                  <button className="row-x" aria-label={"Remove " + g.title} onClick={() => removeGoal(g)}>×</button>
                </li>
              ))}
            </ul>
            <p className="note" style={{ marginTop: 10 }}>Done and dusted. Proof you keep your word to yourself.</p>
          </section>
        )}
      </div>
    </div>
  );
}
