"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable and can receive push.
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // registration is best-effort; the app works fine without it
    });
  }, []);
  return null;
}
