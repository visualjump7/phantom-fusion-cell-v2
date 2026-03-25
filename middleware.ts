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
  if (user && (pathname.startsWith("/admin") || pathname === "/upload")) {
    // Query all the user's memberships (supports multi-org)
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    // Normalize legacy roles
    const roles = (memberships || []).map((m: { role: string; organization_id: string }) => ({
      role: m.role === "owner" ? "admin" : m.role === "accountant" ? "manager" : m.role,
      organization_id: m.organization_id,
    }));

    const userRole = roles.length > 0 ? roles[0].role : null;
    const isAdmin = userRole === "admin";
    const isStaff = isAdmin || userRole === "manager";
    const isTeam = isStaff || userRole === "viewer";

    // /admin/* routes: accessible by isTeam (admin, manager, viewer)
    if (pathname.startsWith("/admin") && !isTeam) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // /upload: accessible by isStaff (admin, manager)
    if (pathname === "/upload" && !isStaff) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // /admin/onboard: admin only
    if (pathname === "/admin/onboard" && !isAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // /admin/users: admin only
    if (pathname === "/admin/users" && !isAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // /admin/bills: staff only (admin, manager)
    if (pathname === "/admin/bills" && !isStaff) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // For workspace routes, check access
    const workspaceMatch = pathname.match(/^\/admin\/client\/([^/]+)/);
    if (workspaceMatch) {
      const targetOrgId = workspaceMatch[1];

      if (isAdmin) {
        // Admins can access any workspace — verify org exists via membership
        // (admins are members of all orgs they manage)
      } else {
        // Manager/viewer: check principal_assignments
        const { data: assignments } = await supabase
          .from("principal_assignments")
          .select("id")
          .eq("user_id", user.id)
          .eq("organization_id", targetOrgId)
          .limit(1);

        if (!assignments || assignments.length === 0) {
          return NextResponse.redirect(new URL("/admin", request.url));
        }
      }

      // Check upload sub-route for viewer restriction
      if (pathname.endsWith("/upload") && !isStaff) {
        return NextResponse.redirect(new URL(`/admin/client/${targetOrgId}`, request.url));
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
