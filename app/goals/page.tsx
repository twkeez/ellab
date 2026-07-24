"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Goal = { id: number; title: string; why: string | null; done: boolean };

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
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!
        .from("goals")
        .select("id,title,why,done")
        .order("created_at");
      if (alive && data) setGoals(data as Goal[]);
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
        .select("id,title,why,done")
        .single();
      if (data) setGoals((g) => [...g, data as Goal]);
    }
  };

  const setDone = async (g: Goal, done: boolean) => {
    setGoals((gs) => gs.map((x) => (x.id === g.id ? { ...x, done } : x)));
    if (supabase) await supabase.from("goals").update({ done }).eq("id", g.id);
  };

  const removeGoal = async (g: Goal) => {
    setGoals((gs) => gs.filter((x) => x.id !== g.id));
    if (supabase) await supabase.from("goals").delete().eq("id", g.id);
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
          <ul className="list goals">
            {active.length === 0 ? (
              <li><span className="gtext" style={{ color: "var(--text-soft)" }}>Name something bigger you&apos;re working toward — add it below.</span></li>
            ) : (
              active.map((g) => (
                <li key={g.id}>
                  <button className="check goal-check" aria-label={"Mark " + g.title + " achieved"} title="Mark achieved" onClick={() => setDone(g, true)} />
                  <span className="gtext">
                    <b style={{ fontWeight: 600 }}>{g.title}</b>
                    {g.why && <i style={{ display: "block", fontStyle: "normal", fontSize: 12.5, color: "var(--text-soft)", marginTop: 3, lineHeight: 1.4 }}>{g.why}</i>}
                  </span>
                  <button className="row-x" aria-label={"Remove " + g.title} onClick={() => removeGoal(g)}>×</button>
                </li>
              ))
            )}
          </ul>

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
