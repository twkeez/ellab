"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Hit = { type: string; label: string; sub?: string; href: string; external?: boolean };

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tod, setTod] = useState("day");
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Hit[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onEvt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("the-lab:search", onEvt as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("the-lab:search", onEvt as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setTod(autoTod());
    setQ("");
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || index !== null || !supabase) return;
    (async () => {
      const hits: Hit[] = [];
      const [notes, groc, todos, radar, rec, chores, events, drafts, exps] = await Promise.all([
        supabase!.from("notes").select("text"),
        supabase!.from("groceries").select("text,done"),
        supabase!.from("todos").select("text,done"),
        supabase!.from("radar_items").select("type,title,author"),
        supabase!.from("recipes").select("name,area,category,source"),
        supabase!.from("chores").select("name"),
        supabase!.from("events").select("title,date,time"),
        supabase!.from("drafts").select("title,body"),
        supabase!.from("experiments").select("title,note"),
      ]);
      for (const r of notes.data ?? []) hits.push({ type: "note", label: r.text, href: "/" });
      for (const r of groc.data ?? []) hits.push({ type: "grocery", label: r.text, sub: r.done ? "got it" : undefined, href: "/" });
      for (const r of todos.data ?? []) hits.push({ type: "to-do", label: r.text, sub: r.done ? "done" : undefined, href: "/" });
      for (const r of radar.data ?? []) hits.push({ type: r.type, label: r.title, sub: r.author ?? undefined, href: "/" });
      for (const r of rec.data ?? []) hits.push({ type: "recipe", label: r.name, sub: [r.area, r.category].filter(Boolean).join(" · ") || undefined, href: r.source || "/recipes", external: !!r.source });
      for (const r of chores.data ?? []) hits.push({ type: "chore", label: r.name, href: "/chores" });
      for (const r of events.data ?? []) hits.push({ type: "event", label: r.title, sub: r.date, href: "/calendar" });
      for (const r of drafts.data ?? []) hits.push({ type: "draft", label: r.title, href: "/write" });
      for (const r of exps.data ?? []) hits.push({ type: "idea", label: r.title, sub: r.note ?? undefined, href: "/experiments" });
      setIndex(hits);
    })();
  }, [open, index]);

  const needle = q.trim().toLowerCase();
  const results = !index || !needle
    ? []
    : index
        .filter((h) => h.label.toLowerCase().includes(needle) || h.sub?.toLowerCase().includes(needle))
        .slice(0, 24);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    if (h.external) window.open(h.href, "_blank", "noopener,noreferrer");
    else router.push(h.href);
  };

  if (!open) return null;

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk-root cmdk-panel" data-tod={tod} data-accent="honey" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search everything — notes, lists, recipes, events…"
          aria-label="Search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
          }}
        />
        <div className="cmdk-results">
          {index === null ? (
            <p className="cmdk-empty">Gathering everything…</p>
          ) : !needle ? (
            <p className="cmdk-empty">Type to search across the whole lab.</p>
          ) : results.length === 0 ? (
            <p className="cmdk-empty">Nothing matches “{q}”.</p>
          ) : (
            results.map((h, i) => (
              <div
                key={i}
                className={"cmdk-item" + (i === active ? " on" : "")}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
              >
                <span className="cmdk-type">{h.type}</span>
                <span className="cmdk-label">{h.label}</span>
                {h.sub && <span className="cmdk-sub">{h.sub}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
