"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function autoTod(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function LoginPage() {
  const [tod, setTod] = useState("day");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTod(autoTod());
    const params = new URLSearchParams(window.location.search);
    setError(params.get("error"));
  }, []);

  const signIn = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const message =
    error === "notallowed"
      ? "That account isn't allowed. Sign in with kieseltom@gmail.com."
      : error
      ? "Sign-in didn't complete — give it another try."
      : null;

  return (
    <div className="hub" data-tod={tod} data-accent="honey">
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            WebkitBackdropFilter: "blur(var(--blur)) saturate(1.4)",
            backdropFilter: "blur(var(--blur)) saturate(1.4)",
            boxShadow: "var(--shadow)",
            borderRadius: 22,
            padding: "40px 34px",
            width: "100%",
            maxWidth: 380,
            textAlign: "center",
            color: "var(--text)",
          }}
        >
          <h1 style={{ fontWeight: 600, letterSpacing: "-0.02em", fontSize: "2.2rem", margin: 0 }}>The Lab</h1>
          <p style={{ color: "var(--text-soft)", fontSize: 14, margin: "8px 0 28px" }}>
            a home for half-formed ideas
          </p>

          {message && (
            <p style={{ color: "#d9534f", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>{message}</p>
          )}

          <button
            onClick={signIn}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "13px 18px",
              borderRadius: 999,
              border: "1px solid var(--border-2)",
              background: "var(--surface-strong)",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
