import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

// The anon/public key is safe to ship to the browser — it's protected by
// Row Level Security in the database, not by being secret. Never put the
// service_role (secret) key here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cookie-aware browser client: it shares the login session, so once signed in,
// every data request carries the user's identity (which RLS then enforces).
// Created only in the browser; null on the server and before keys are set, so
// the app still runs locally without configuration.
export const supabase: SupabaseClient | null =
  typeof window !== "undefined" && url && anonKey
    ? createBrowserClient(url, anonKey)
    : null;
