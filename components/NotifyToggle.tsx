"use client";

import { useEffect, useState } from "react";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlB64ToUint8(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "hidden" | "unsupported" | "blocked" | "prompt" | "busy" | "enabled";

export default function NotifyToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !KEY) { setState("hidden"); return; }
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported"); return;
      }
      if (Notification.permission === "denied") { setState("blocked"); return; }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub ? "enabled" : "prompt");
    })();
  }, []);

  const enable = async () => {
    if (!KEY) return;
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "prompt"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(KEY) as BufferSource,
      });
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
      setState(r.ok ? "enabled" : "prompt");
    } catch {
      setState("prompt");
    }
  };

  if (state === "loading" || state === "hidden") return null;

  return (
    <section className="brief-block brief-notify">
      <div>
        <p className="brief-label">Daily nudges</p>
        <p className="brief-notify-sub">
          {state === "enabled" && "On — a morning brief and an evening check-in."}
          {state === "prompt" && "A gentle morning and evening nudge to keep the streak."}
          {state === "busy" && "Setting up…"}
          {state === "blocked" && "Blocked — turn notifications on for this app in your settings."}
          {state === "unsupported" && "Add this to your Home Screen first, then turn nudges on from there."}
        </p>
      </div>
      {state === "prompt" && (
        <button className="mini accent" style={{ marginTop: 0 }} onClick={enable}>Turn on</button>
      )}
      {state === "enabled" && <span className="brief-notify-on">🔔 on</span>}
      {state === "busy" && <span className="brief-notify-on">…</span>}
    </section>
  );
}
