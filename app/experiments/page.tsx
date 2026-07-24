"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TOOLS } from "@/lib/tools";

type Experiment = { id: number; title: string; link: string | null; note: string | null };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function ExperimentsPage() {
  const [tod, setTod] = useState("day");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!
        .from("experiments")
        .select("id,title,link,note")
        .order("created_at", { ascending: false });
      if (alive && data) setExperiments(data as Experiment[]);
    })();
    return () => { alive = false; };
  }, []);

  const addExperiment = async () => {
    const t = title.trim();
    if (!t) return;
    const payload = { title: t, note: note.trim() || null, link: null };
    setTitle("");
    setNote("");
    if (supabase) {
      const { data } = await supabase
        .from("experiments").insert(payload).select("id,title,link,note").single();
      if (data) setExperiments((e) => [data as Experiment, ...e]);
    }
  };

  const removeExperiment = async (e: Experiment) => {
    setExperiments((es) => es.filter((x) => x.id !== e.id));
    if (supabase) await supabase.from("experiments").delete().eq("id", e.id);
  };

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 900 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> the workshop</p>
            <h1 className="studio-h1">Everything in the lab</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile">
          <p className="eyebrow"><span className="dot" /> built in · {TOOLS.length}</p>
          <div className="exp-grid">
            {TOOLS.map((t) => (
              <Link key={t.name} href={t.href} className="exp-card">
                <b>{t.name}</b>
                <span>{t.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> your experiments · {experiments.length}</p>
          {experiments.length === 0 ? (
            <p className="note">Nothing here yet. This is your scratchpad for whims — ideas to build, half-baked tools, things to try. Jot one below.</p>
          ) : (
            <ul className="list">
              {experiments.map((e) => (
                <li key={e.id}>
                  <span className="gtext">
                    <b style={{ fontWeight: 500 }}>{e.title}</b>
                    {e.note && (
                      <i style={{ display: "block", fontStyle: "normal", color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>{e.note}</i>
                    )}
                  </span>
                  <button className="row-x" aria-label={"Remove " + e.title} onClick={() => removeExperiment(e)}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="addrow" style={{ flexWrap: "wrap" }}>
            <input
              placeholder="an idea to build…"
              aria-label="Experiment idea"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addExperiment(); }}
              style={{ minWidth: 160 }}
            />
            <input
              placeholder="a note (optional)"
              aria-label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addExperiment(); }}
              style={{ minWidth: 160 }}
            />
            <button className="iconbtn" aria-label="Add" onClick={addExperiment}>+</button>
          </div>
        </section>
      </div>
    </div>
  );
}
