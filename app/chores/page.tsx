"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Chore = { id: number; name: string; last_done: string | null };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function pad(n: number) { return n < 10 ? "0" + n : String(n); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function sortChores(a: Chore, b: Chore): number {
  if (a.last_done === b.last_done) return a.id - b.id;
  if (a.last_done === null) return -1;
  if (b.last_done === null) return 1;
  return a.last_done < b.last_done ? -1 : 1;
}

function ago(iso: string | null): string {
  if (!iso) return "never done";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "done today";
  if (days === 1) return "done yesterday";
  if (days < 7) return `done ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "done last week";
  if (weeks < 5) return `done ${weeks} weeks ago`;
  return "done a while ago";
}

export default function ChoresPage() {
  const [tod, setTod] = useState("day");
  const [chores, setChores] = useState<Chore[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastDoneDate, setLastDoneDate] = useState<string | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data: c } = await supabase!
        .from("chores")
        .select("id,name,last_done")
        .order("last_done", { ascending: true, nullsFirst: true })
        .order("created_at");
      if (alive && c) setChores(c as Chore[]);

      const { data: m } = await supabase!
        .from("app_meta").select("streak,last_done_date").eq("id", 1).single();
      if (alive && m) { setStreak(m.streak ?? 0); setLastDoneDate(m.last_done_date ?? null); }
    })();
    return () => { alive = false; };
  }, []);

  const addChore = async () => {
    const v = input.trim();
    if (!v) return;
    setInput("");
    if (supabase) {
      const { data } = await supabase
        .from("chores").insert({ name: v }).select("id,name,last_done").single();
      if (data) setChores((c) => [...c, data as Chore].sort(sortChores));
    }
  };

  const removeChore = async (c: Chore) => {
    setChores((cs) => cs.filter((x) => x.id !== c.id));
    if (supabase) await supabase.from("chores").delete().eq("id", c.id);
  };

  const markDone = async (c: Chore) => {
    const now = new Date();
    const today = ymd(now);
    const yesterday = ymd(new Date(now.getTime() - 86400000));
    const newStreak = lastDoneDate === today ? streak || 1 : lastDoneDate === yesterday ? streak + 1 : 1;
    const nowIso = now.toISOString();

    setChores((cs) =>
      [...cs.map((x) => (x.id === c.id ? { ...x, last_done: nowIso } : x))].sort(sortChores)
    );
    setStreak(newStreak);
    setLastDoneDate(today);
    if (supabase) {
      await supabase.from("chores").update({ last_done: nowIso }).eq("id", c.id);
      await supabase.from("app_meta").update({ streak: newStreak, last_done_date: today }).eq("id", 1);
    }
  };

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 760 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> chores</p>
            <h1 className="studio-h1">Keeping the place up</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <p className="eyebrow"><span className="dot" /> all chores · {chores.length}</p>
            <span className="streak">🔥&#8202;<b>{streak}</b>&#8202;day streak</span>
          </div>

          <ul className="list">
            {chores.length === 0 ? (
              <li><span className="gtext" style={{ color: "var(--text-soft)" }}>No chores yet — add one below.</span></li>
            ) : (
              chores.map((c) => (
                <li key={c.id}>
                  <button className="check chore-check" aria-label={"Mark " + c.name + " done"} onClick={() => markDone(c)}>✓</button>
                  <span className="gtext">
                    <b style={{ fontWeight: 500 }}>{c.name}</b>
                    <i style={{ display: "block", fontStyle: "normal", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{ago(c.last_done)}</i>
                  </span>
                  <button className="row-x" aria-label={"Remove " + c.name} onClick={() => removeChore(c)}>×</button>
                </li>
              ))
            )}
          </ul>

          <div className="addrow">
            <input
              placeholder="add a chore…"
              aria-label="Add a chore"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addChore(); }}
            />
            <button className="iconbtn" aria-label="Add" onClick={addChore}>+</button>
          </div>

          <p className="note" style={{ marginTop: 12 }}>
            The one you&apos;ve neglected longest becomes &ldquo;today&apos;s focus&rdquo; back on the hub. Tick it here or there — same list.
          </p>
        </section>
      </div>
    </div>
  );
}
