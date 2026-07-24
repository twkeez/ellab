import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Used by the push subscribe +
// cron routes, which have no user session. NEVER import this into client code.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
