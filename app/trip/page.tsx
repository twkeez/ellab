"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TRIP, PHASES, DEFAULT_TASKS, DEFAULT_BOOKINGS, daysUntil } from "@/lib/trip";

type Task = { id: number; phase: string; title: string; urgent: boolean; done: boolean };
type Booking = { id: number; label: string; detail: string; done: boolean };
type TripNote = { id: number; text: string };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// Guards against React StrictMode double-running the seed effect in dev.
let seededOnce = false;

export default function TripPage() {
  const [tod, setTod] = useState("day");
  const [now, setNow] = useState(() => Date.now());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [taskPhase, setTaskPhase] = useState(PHASES[0]);
  const [noteInput, setNoteInput] = useState("");
  const [dbMissing, setDbMissing] = useState(false);
  const loaded = useRef(false);

  useEffect(() => { setTod(autoTod()); const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!supabase || loaded.current) return;
    loaded.current = true;
    let alive = true;
    (async () => {
      const { data: t, error: te } = await supabase!.from("trip_tasks").select("id,phase,title,urgent,done").order("id");
      if (te) { if (alive) setDbMissing(true); return; }

      if (t && t.length === 0 && !seededOnce) {
        // First visit: seed the checklist + bookings from the plan.
        seededOnce = true;
        const { data: seeded } = await supabase!
          .from("trip_tasks")
          .insert(DEFAULT_TASKS.map((d) => ({ ...d, done: false })))
          .select("id,phase,title,urgent,done");
        if (alive && seeded) setTasks(seeded as Task[]);
        const { data: sb } = await supabase!
          .from("trip_bookings")
          .insert(DEFAULT_BOOKINGS)
          .select("id,label,detail,done");
        if (alive && sb) setBookings(sb as Booking[]);
      } else if (alive && t) {
        setTasks(t as Task[]);
        const { data: b } = await supabase!.from("trip_bookings").select("id,label,detail,done").order("id");
        if (alive && b) setBookings(b as Booking[]);
      }

      const { data: n } = await supabase!.from("trip_notes").select("id,text").order("created_at");
      if (alive && n) setNotes(n as TripNote[]);
    })();
    return () => { alive = false; };
  }, []);

  const toggleTask = async (t: Task) => {
    const next = !t.done;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    if (supabase) await supabase.from("trip_tasks").update({ done: next }).eq("id", t.id);
  };

  const removeTask = async (t: Task) => {
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    if (supabase) await supabase.from("trip_tasks").delete().eq("id", t.id);
  };

  const addTask = async () => {
    const v = taskInput.trim();
    if (!v) return;
    setTaskInput("");
    if (supabase) {
      const { data } = await supabase
        .from("trip_tasks").insert({ phase: taskPhase, title: v, urgent: false, done: false })
        .select("id,phase,title,urgent,done").single();
      if (data) setTasks((ts) => [...ts, data as Task]);
    }
  };

  const toggleBooking = async (b: Booking) => {
    const next = !b.done;
    setBookings((bs) => bs.map((x) => (x.id === b.id ? { ...x, done: next } : x)));
    if (supabase) await supabase.from("trip_bookings").update({ done: next }).eq("id", b.id);
  };

  const addNote = async () => {
    const v = noteInput.trim();
    if (!v) return;
    setNoteInput("");
    if (supabase) {
      const { data } = await supabase.from("trip_notes").insert({ text: v }).select("id,text").single();
      if (data) setNotes((ns) => [...ns, data as TripNote]);
    }
  };

  const removeNote = async (n: TripNote) => {
    setNotes((ns) => ns.filter((x) => x.id !== n.id));
    if (supabase) await supabase.from("trip_notes").delete().eq("id", n.id);
  };

  const dDays = daysUntil(TRIP.departISO, now);
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const bookedCount = bookings.filter((b) => b.done).length;

  const nextUrgent = useMemo(
    () => tasks.find((t) => !t.done && t.urgent) ?? tasks.find((t) => !t.done) ?? null,
    [tasks]
  );

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>

      <div className="studio-wrap" style={{ maxWidth: 860 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> the big trip</p>
            <h1 className="studio-h1" style={{ fontFamily: "var(--serif)" }}>{TRIP.name}</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        {/* Hero: countdown + progress */}
        <section className="tile trip-hero">
          <div className="trip-count">
            <span className="trip-count-num">{dDays}</span>
            <span className="trip-count-label">days to wheels-up</span>
          </div>
          <div className="trip-hero-body">
            <p className="trip-tagline">{TRIP.tagline}</p>
            <p className="trip-dates">Apr 14 → Jun 18, 2027 · {TRIP.days} days</p>
            <div className="trip-meter" role="img" aria-label={`Prep ${pct}% done`}>
              <div className="trip-meter-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="trip-meter-label">{doneCount}/{tasks.length || "—"} prep tasks · {bookedCount}/{bookings.length || "—"} bookings locked</p>
          </div>
        </section>

        {/* Route */}
        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> the route</p>
          <div className="trip-route">
            {TRIP.route.map((s, i) => (
              <div className="trip-stop" key={i}>
                <div className="trip-stop-head">
                  <span className="trip-stop-code">{s.code}</span>
                  {i < TRIP.route.length - 1 && <span className="trip-stop-line" aria-hidden="true" />}
                </div>
                <span className="trip-stop-city">{s.label}</span>
                <span className="trip-stop-note">{s.note}</span>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>Side trip: Bernina Express through the Alps, from the Slovenia base in June.</p>
        </section>

        {/* Key windows */}
        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> key windows</p>
          {TRIP.windows.map((w, i) => {
            const d = daysUntil(w.dateISO, now);
            return (
              <div className="trip-window" key={i}>
                <span className={"goal-target" + (d <= 21 ? " hot" : "")}>◷ {d > 0 ? `${d} days` : "open now"}</span>
                <span className="trip-window-label"><b>{w.label}</b> · {w.when}</span>
              </div>
            );
          })}
          <p className="note" style={{ marginTop: 8 }}>Seats on the panoramic cars sell out — book train + bus reservations the week they open.</p>
        </section>

        {/* Checklist */}
        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> prep checklist</p>
          {dbMissing && (
            <p className="note" style={{ color: "#E0483C", marginTop: 8 }}>
              The trip tables aren&apos;t set up yet — run the SQL and this fills itself in.
            </p>
          )}
          {PHASES.map((ph) => {
            const list = tasks.filter((t) => t.phase === ph);
            if (!list.length) return null;
            const open = list.filter((t) => !t.done).length;
            return (
              <div className="trip-phase" key={ph}>
                <p className="trip-phase-name">{ph} {open === 0 ? <span className="trip-phase-done">✓ all done</span> : <span className="trip-phase-count">{open} open</span>}</p>
                <ul className="list">
                  {list.map((t) => (
                    <li key={t.id} className={t.done ? "done" : ""}>
                      <button className={"check" + (t.done ? " done" : "")} aria-label={"Toggle " + t.title} aria-pressed={t.done} onClick={() => toggleTask(t)}>
                        {t.done ? "✓" : ""}
                      </button>
                      <span className="gtext">
                        {t.title}
                        {t.urgent && !t.done && <span className="trip-urgent"> time-sensitive</span>}
                      </span>
                      <button className="row-x" aria-label={"Remove " + t.title} onClick={() => removeTask(t)}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="trip-add">
            <select className="habit-link-select" style={{ width: "auto", marginTop: 0 }} aria-label="Phase" value={taskPhase} onChange={(e) => setTaskPhase(e.target.value)}>
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input placeholder="add a prep task…" aria-label="Add a prep task" value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} />
            <button className="iconbtn" aria-label="Add task" onClick={addTask}>+</button>
          </div>
        </section>

        {/* Bookings */}
        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> bookings · {bookedCount}/{bookings.length || "—"} locked</p>
          <div className="trip-bookings">
            {bookings.map((b) => (
              <button key={b.id} className={"trip-booking" + (b.done ? " locked" : "")} onClick={() => toggleBooking(b)} aria-pressed={b.done}>
                <span className="trip-booking-mark">{b.done ? "✓" : "○"}</span>
                <span className="trip-booking-body">
                  <b>{b.label}</b>
                  <i>{b.done ? "Locked in" : b.detail}</i>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Flights */}
        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> flights · {TRIP.flights.fare}</p>
          <div className="trip-legs">
            <div>
              <p className="trip-leg-head">Outbound · Apr 14</p>
              {TRIP.flights.out.map((f, i) => (
                <div className="trip-leg" key={i}>
                  <span className="trip-leg-no">{f.fno}</span>
                  <span className="trip-leg-route"><b>{f.from} → {f.to}</b> · {f.dep} → {f.arr}</span>
                  <span className="trip-leg-meta">{[f.dur, f.eq].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
              <p className="note" style={{ marginTop: 6 }}>3h 24m connection at JFK — comfortable, both legs Delta.</p>
            </div>
            <div>
              <p className="trip-leg-head">Return · Jun 18</p>
              {TRIP.flights.ret.map((f, i) => (
                <div className="trip-leg" key={i}>
                  <span className="trip-leg-no">{f.fno}</span>
                  <span className="trip-leg-route"><b>{f.from} → {f.to}</b> · {f.dep} → {f.arr}</span>
                  <span className="trip-leg-meta">{[f.dur, f.eq].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
              <p className="note" style={{ marginTop: 6 }}>{TRIP.flights.bags}</p>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> trip notes</p>
          {notes.length === 0 ? (
            <p className="note" style={{ marginTop: 8 }}>Research, addresses, ideas — anything worth keeping with the trip.</p>
          ) : (
            <ul className="list">
              {notes.map((n) => (
                <li key={n.id}>
                  <span className="gtext">{n.text}</span>
                  <button className="row-x" aria-label="Remove note" onClick={() => removeNote(n)}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="addrow">
            <input placeholder="add a note…" aria-label="Add a trip note" value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
            <button className="iconbtn" aria-label="Add note" onClick={addNote}>+</button>
          </div>
        </section>
      </div>
    </div>
  );
}
