import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * /auth/callback?code=...&next=...
 *
 * Magic-link / OAuth landing route. Exchanges the auth code for a session,
 * then bounces the user to the target page (`?next=`) or home.
 *
 * On failure we route back to /login with a human-readable `?error=` so the
 * user sees what happened — previously the bounce was silent and the user
 * just saw the login screen again with no explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Validate next is a same-origin path. Refuse anything else so the URL
  // can't be weaponized into an open redirect.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  function loginWithError(message: string) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", message);
    if (safeNext !== "/") url.searchParams.set("redirect_to", safeNext);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return loginWithError("Sign-in link is missing required information.");
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Most common case is an expired link (1-hour TTL on Supabase).
    // Normalize a few known errors; otherwise generic copy so we don't leak
    // backend details.
    const friendly = /expired/i.test(error.message)
      ? "Your sign-in link has expired. Request a new one."
      : "We couldn't complete sign-in. Try again or request a new link.";
    return loginWithError(friendly);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
