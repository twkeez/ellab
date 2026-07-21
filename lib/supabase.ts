import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The anon/public key is safe to ship to the browser — it's protected by
// Row Level Security in the database, not by being secret. Never put the
// service_role (secret) key here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null until the keys are configured, so the app still runs (with local-only
// data) before Supabase is wired up.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
