import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = cookies();

  // Anon client — used to verify the calling user's identity via session cookie
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  // ── Verify caller is an admin ──
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const callerRole = membership?.role;
  if (callerRole !== "admin" && callerRole !== "owner") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // ── Parse + validate request ──
  const body = await request.json();
  const { email, fullName, role: inviteRole, principalOrgIds, password } = body;

  if (!email || !fullName || !inviteRole || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (!["admin", "manager", "viewer"].includes(inviteRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (
    (inviteRole === "manager" || inviteRole === "viewer") &&
    (!principalOrgIds || principalOrgIds.length === 0)
  ) {
    return NextResponse.json(
      { error: "Manager and viewer roles require at least one principal assignment" },
      { status: 400 }
    );
  }

  // ── Service role key is required for auth.admin calls ──
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local to enable invitations.",
      },
      { status: 501 }
    );
  }

  // ── Admin client (bypasses RLS, can create users) ──
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  try {
    // 1. Create user with password — no email invite needed
    const { data: createData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 422 });
    }

    const newUserId = createData.user.id;

    // 2. Update the auto-created profile row
    await adminClient
      .from("profiles")
      .update({
        full_name: fullName,
        status: "active",
        invited_by: user.id,
      })
      .eq("id", newUserId);

    // 3. Create organization_members row (same org as the admin)
    const orgId = membership!.organization_id;
    const { error: memberError } = await adminClient
      .from("organization_members")
      .insert({
        user_id: newUserId,
        organization_id: orgId,
        role: inviteRole,
        status: "active",
      });

    if (memberError) {
      console.error("[invite] org member insert:", memberError);
      // User was created in auth but membership failed — not ideal, but recoverable
    }

    // 4. Create principal_assignments for manager/viewer
    if (
      (inviteRole === "manager" || inviteRole === "viewer") &&
      principalOrgIds?.length > 0
    ) {
      const assignments = principalOrgIds.map((pOrgId: string) => ({
        user_id: newUserId,
        organization_id: pOrgId,
        assigned_by: user.id,
      }));

      const { error: assignError } = await adminClient
        .from("principal_assignments")
        .insert(assignments);

      if (assignError) {
        console.error("[invite] assignment insert:", assignError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[invite] unexpected:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
