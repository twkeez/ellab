import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Google redirects here after sign-in. We exchange the code for a session,
// then verify it's the allowed account — anyone else is signed straight back out.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
      if (allowed && data.user.email?.toLowerCase() !== allowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=notallowed`);
      }
      return NextResponse.redirect(origin);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
