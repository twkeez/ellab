"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SavedRecipe = {
  id: number;
  name: string;
  category: string | null;
  area: string | null;
  source: string | null;
};

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function RecipesPage() {
  const [tod, setTod] = useState("day");
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => { setTod(autoTod()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase!
        .from("recipes")
        .select("id,name,category,area,source")
        .order("created_at", { ascending: false });
      if (alive && data) setRecipes(data as SavedRecipe[]);
    })();
    return () => { alive = false; };
  }, []);

  const addRecipe = async () => {
    const n = name.trim();
    if (!n) return;
    const s = link.trim() || null;
    setName("");
    setLink("");
    if (supabase) {
      const { data } = await supabase
        .from("recipes")
        .insert({ name: n, source: s })
        .select("id,name,category,area,source")
        .single();
      if (data) setRecipes((r) => [data as SavedRecipe, ...r]);
    }
  };

  const removeRecipe = async (r: SavedRecipe) => {
    setRecipes((rs) => rs.filter((x) => x.id !== r.id));
    if (supabase) await supabase.from("recipes").delete().eq("id", r.id);
  };

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <div className="studio-wrap" style={{ maxWidth: 900 }}>
        <header className="studio-top">
          <div>
            <p className="eyebrow"><span className="dot" /> recipes</p>
            <h1 className="studio-h1">Things worth cooking</h1>
          </div>
          <Link href="/" className="mini" style={{ marginTop: 0 }}>← back to the lab</Link>
        </header>

        <section className="tile">
          <p className="eyebrow"><span className="dot" /> saved · {recipes.length}</p>

          <ul className="list media">
            {recipes.length === 0 ? (
              <li>
                <span className="gtext" style={{ color: "var(--text-soft)" }}>
                  Nothing saved yet. Hit <b>Save</b> on a dinner idea you like, or add one below.
                </span>
              </li>
            ) : (
              recipes.map((r) => (
                <li key={r.id}>
                  <span className="gtext">
                    {r.source ? (
                      <a href={r.source} target="_blank" rel="noopener noreferrer"><b>{r.name}</b></a>
                    ) : (
                      <b>{r.name}</b>
                    )}
                    {(r.area || r.category) && (
                      <> <i>{[r.area, r.category].filter(Boolean).join(" · ")}</i></>
                    )}
                  </span>
                  <button className="row-x" aria-label={"Remove " + r.name} onClick={() => removeRecipe(r)}>×</button>
                </li>
              ))
            )}
          </ul>

          <div className="addrow">
            <input
              placeholder="add a recipe…"
              aria-label="Recipe name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRecipe(); }}
            />
            <input
              placeholder="link (optional)"
              aria-label="Recipe link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRecipe(); }}
              style={{ maxWidth: 200 }}
            />
            <button className="iconbtn" aria-label="Add" onClick={addRecipe}>+</button>
          </div>
        </section>
      </div>
    </div>
  );
}
