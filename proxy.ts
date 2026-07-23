import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Always refresh the session so it stays valid.
  const { data: { user } } = await supabase.auth.getUser();

  // The gate is off until AUTH_REQUIRED is set, so the app stays usable while
  // Google sign-in is still being configured.
  if (process.env.AUTH_REQUIRED === "true") {
    const path = request.nextUrl.pathname;
    const isPublic = path.startsWith("/login") || path.startsWith("/auth");
    const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
    const isAllowedUser = !!user && (!allowed || user.email?.toLowerCase() === allowed);

    if (!isAllowedUser && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
