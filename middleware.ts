import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes — no auth needed
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth");

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ========================================
  // ROLE-BASED ROUTE PROTECTION
  // ========================================
  // Admin-only routes: /admin/*, /upload
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname === "/upload";

  if (user && isAdminRoute) {
    // Query all the user's memberships (supports multi-org)
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const hasAdminAccess = (memberships || []).some(
      (m: { role: string }) => m.role === "owner" || m.role === "admin" || m.role === "accountant"
    );

    if (!hasAdminAccess) {
      // Executive or unknown role — redirect to dashboard
      return NextResponse.redirect(new URL("/", request.url));
    }

    // For workspace routes, verify user has membership in the target org
    const workspaceMatch = pathname.match(/^\/admin\/client\/([^/]+)/);
    if (workspaceMatch) {
      const targetOrgId = workspaceMatch[1];
      const hasMembership = (memberships || []).some(
        (m: { organization_id: string }) => m.organization_id === targetOrgId
      );
      if (!hasMembership) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
