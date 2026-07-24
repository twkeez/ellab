"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Ev = { id: number; title: string; date: string; time: string | null };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) { return n < 10 ? "0" + n : String(n); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function dayLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const t = new Date(today + "T00:00:00");
  if (dateStr === ymd(new Date(t.getTime() + 86400000))) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function timeLabel(time: string | null): string {
  if (!time) return "all day";
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 || 12}:${pad(m)}${suffix}`;
}

export default function CalendarPage() {
  const [tod, setTod] = useState("day");
  const [events, setEvents] = useState<Ev[]>([]);
  const [today, setToday] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    setTod(autoTod());
    const t = ymd(new Date());
    setToday(t);
    setDate(t);
  }, []);

  useEffect(() => {
    if (!supabase || !today) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!
        .from("events")
        .select("id,title,date,time")
        .gte("date", today)
        .order("date", { ascending: true })
        .order("time", { ascending: true, nullsFirst: true });
      if (alive && data) setEvents(data as Ev[]);
    })();
    return () => { alive = false; };
  }, [today]);

  const addEvent = async () => {
    const t = title.trim();
    if (!t || !date) return;
    const payload = { title: t, date, time: time || null };
    setTitle("");
    setTime("");
    if (supabase) {
      const { data } = await supabase
        .from("events").insert(payload).select("id,title,date,time").single();
      if (data) {
        setEvents((es) =>
          [...es, data as Ev].sort((a, b) =>
            a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? "") < (b.time ?? "") ? -1 : 1
          )
        );
      }
    }
  };

  const removeEvent = async (e: Ev) => {
    setEvents((es) => es.filter((x) => x.id !== e.id));
    if (supabase) await supabase.from("events").delete().eq("id", e.id);
  };

  const groups = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 760 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> calendar</p>
            <h1 className="studio-h1">What&apos;s coming up</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile">
          <p className="eyebrow"><span className="dot" /> add an event</p>
          <div className="cal-add">
            <input
              className="cal-title"
              placeholder="what's happening?"
              aria-label="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addEvent(); }}
            />
            <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" aria-label="Time (optional)" value={time} onChange={(e) => setTime(e.target.value)} />
            <button className="mini accent" style={{ marginTop: 0 }} onClick={addEvent}>Add</button>
          </div>
        </section>

        <section className="tile" style={{ marginTop: 16 }}>
          <p className="eyebrow"><span className="dot" /> upcoming</p>
          {groups.length === 0 ? (
            <p className="note">Nothing on the calendar yet. Add something above — it&apos;ll show on your hub&apos;s &ldquo;Today&rdquo; tile when the day comes.</p>
          ) : (
            <div className="cal-groups">
              {groups.map(([d, evs]) => (
                <div key={d} className="cal-group">
                  <p className="cal-day">{dayLabel(d, today)}</p>
                  <ul className="list">
                    {evs.map((e) => (
                      <li key={e.id}>
                        <span className="ev-time" style={{ width: 62 }}>{timeLabel(e.time)}</span>
                        <span className="gtext">{e.title}</span>
                        <button className="row-x" aria-label={"Remove " + e.title} onClick={() => removeEvent(e)}>×</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
