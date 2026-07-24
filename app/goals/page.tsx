"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Goal = { id: number; title: string; why: string | null; done: boolean; target_date: string | null };
type Step = { id: number; goal_id: number; text: string; done: boolean };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function countdown(target: string | null): { text: string; tone: string } | null {
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target + "T00:00:00");
  const days = Math.round((t.getTime() - today.getTime()) / 86400000);
  if (days > 1) return { text: `${days} days to go`, tone: "" };
  if (days === 1) return { text: "due tomorrow", tone: "hot" };
  if (days === 0) return { text: "due today", tone: "hot" };
  if (days === -1) return { text: "1 day over", tone: "over" };
  return { text: `${-days} days over`, tone: "over" };
}

function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
      <circle className="ring-track" cx="36" cy="36" r={r} />
      <circle
        className="ring-fill"
        cx="36"
        cy="36"
        r={r}
        transform="rotate(-90 36 36)"
        style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct) }}
      />
      <text className="ring-num" x="36" y="37" textAnchor="middle" dominantBaseline="central">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export default function GoalsPage() {
  const [tod, setTod] = useState("day");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [stepInputs, setStepInputs] = useState<Record<number, string>>({});

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

  const active = goals.filter((g) => !g.done);
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
                const pct = total ? done / total : g.done ? 1 : 0;
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
