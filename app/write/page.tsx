"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Draft = { id: number; title: string; body: string; updated_at?: string };

const ACTIONS: { key: string; label: string }[] = [
  { key: "directions", label: "Where could this go?" },
  { key: "continue", label: "Continue the scene" },
  { key: "character", label: "Develop a character" },
  { key: "world", label: "Build the world" },
  { key: "critique", label: "What's working?" },
];

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function words(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function WriteStudio() {
  const [tod, setTod] = useState("day");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(true);

  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!
        .from("drafts")
        .select("id,title,body,updated_at")
        .order("updated_at", { ascending: false });
      if (!alive || !data) return;
      setDrafts(data as Draft[]);
      if (data.length) {
        const first = data[0] as Draft;
        setActiveId(first.id);
        setTitle(first.title);
        setBody(first.body);
      }
    })();
    return () => { alive = false; };
  }, []);

  const persist = useCallback(async (id: number, nextTitle: string, nextBody: string) => {
    if (!supabase) return;
    await supabase
      .from("drafts")
      .update({ title: nextTitle, body: nextBody, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaved(true);
    setDrafts((ds) =>
      ds.map((d) => (d.id === id ? { ...d, title: nextTitle, body: nextBody } : d))
    );
  }, []);

  const queueSave = useCallback(
    (nextTitle: string, nextBody: string) => {
      if (activeId == null) return;
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const id = activeId;
      saveTimer.current = setTimeout(() => persist(id, nextTitle, nextBody), 700);
    },
    [activeId, persist]
  );

  const newDraft = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("drafts")
      .insert({ title: "Untitled", body: "" })
      .select("id,title,body,updated_at")
      .single();
    if (!data) return;
    const d = data as Draft;
    setDrafts((ds) => [d, ...ds]);
    setActiveId(d.id);
    setTitle(d.title);
    setBody(d.body);
    setAiText(null);
  };

  const openDraft = (d: Draft) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (activeId != null && !saved) void persist(activeId, title, body);
    setActiveId(d.id);
    setTitle(d.title);
    setBody(d.body);
    setAiText(null);
    setSaved(true);
  };

  const deleteDraft = async (d: Draft) => {
    if (!supabase) return;
    setDrafts((ds) => ds.filter((x) => x.id !== d.id));
    await supabase.from("drafts").delete().eq("id", d.id);
    if (activeId === d.id) {
      setActiveId(null);
      setTitle("");
      setBody("");
    }
  };

  const runAction = async (action: string) => {
    setAiBusy(action);
    setAiError(null);
    setAiText(null);
    try {
      const res = await fetch("/api/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, title, body, question }),
      });
      const data = await res.json();
      if (!res.ok) setAiError(data.error ?? "Something went wrong.");
      else setAiText(data.text);
    } catch {
      setAiError("Couldn't reach the studio. Check your connection.");
    } finally {
      setAiBusy(null);
    }
  };

  const insertOutput = () => {
    if (!aiText) return;
    const next = body.trimEnd() + (body.trim() ? "\n\n" : "") + aiText + "\n";
    setBody(next);
    queueSave(title, next);
  };

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap">
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> writing studio</p>
            <h1 className="studio-h1">Make something up</h1>
          </div>
          <div className="studio-topright">
            <span className="note">{saved ? "saved" : "saving…"}</span>
            <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
          </div>
        </header>

        <div className="studio-grid">
          <aside className="tile studio-list">
            <p className="eyebrow"><span className="dot" /> drafts</p>
            <ul className="list">
              {drafts.map((d) => (
                <li key={d.id} className={d.id === activeId ? "on" : ""}>
                  <button className="draft-btn" onClick={() => openDraft(d)}>
                    <b>{d.title || "Untitled"}</b>
                    <i>{words(d.body)} words</i>
                  </button>
                  <button className="row-x" aria-label={"Delete " + d.title} onClick={() => deleteDraft(d)}>×</button>
                </li>
              ))}
            </ul>
            <span className="fill" />
            <button className="mini accent" style={{ marginTop: 0 }} onClick={newDraft}>+ New draft</button>
          </aside>

          <main className="tile studio-editor">
            {activeId == null ? (
              <p className="note">Start a draft on the left — a title, a fragment, a mood. Claude works from whatever&apos;s there.</p>
            ) : (
              <>
                <input
                  className="studio-title"
                  value={title}
                  placeholder="Untitled"
                  aria-label="Draft title"
                  onChange={(e) => { setTitle(e.target.value); queueSave(e.target.value, body); }}
                />
                <textarea
                  className="studio-body"
                  value={body}
                  placeholder="Once upon a time…"
                  aria-label="Draft"
                  onChange={(e) => { setBody(e.target.value); queueSave(title, e.target.value); }}
                />
                <p className="note">{words(body)} words</p>
              </>
            )}
          </main>

          <aside className="tile studio-ai">
            <p className="eyebrow"><span className="dot" /> ask claude</p>
            <div className="ai-actions">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  className="mini"
                  style={{ marginTop: 0 }}
                  disabled={aiBusy !== null || activeId == null}
                  onClick={() => runAction(a.key)}
                >
                  {aiBusy === a.key ? "thinking…" : a.label}
                </button>
              ))}
            </div>

            <div className="addrow">
              <input
                placeholder="or ask anything…"
                aria-label="Ask Claude about this draft"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && question.trim()) runAction("ask"); }}
              />
              <button
                className="iconbtn"
                aria-label="Ask"
                disabled={aiBusy !== null || !question.trim() || activeId == null}
                onClick={() => runAction("ask")}
              >
                →
              </button>
            </div>

            <div className="ai-out">
              {aiBusy && <p className="note">Claude is thinking… this takes a few seconds.</p>}
              {aiError && <p className="note" style={{ color: "#d9534f" }}>{aiError}</p>}
              {aiText && <div className="ai-text">{aiText}</div>}
            </div>

            {aiText && (
              <button className="mini accent" style={{ marginTop: 0 }} onClick={insertOutput}>
                Add to draft ↓
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
