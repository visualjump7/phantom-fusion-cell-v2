/**
 * POST /api/admin/add-executive
 *
 * Adds a new executive to an existing principal account (organization).
 * Mirrors the "person" half of /api/admin/onboard-principal — it does NOT
 * create the org or the client_profile, only the auth user (or reuses an
 * existing one), the profile row, the organization_members entry, and the
 * default per-person module visibility config.
 *
 * Behind a service-role client because auth.admin.createUser needs it.
 * Caller must be an admin/owner.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface Body {
  /** Single account — kept for backwards compat with the per-account flow. */
  orgId?: string;
  /** Multiple accounts — used by the global Executive Team page. */
  orgIds?: string[];
  executive: {
    fullName: string;
    email: string;
    phone?: string;
    /** When set, the new executive can sign in with this password immediately
     *  instead of waiting for the magic-link confirmation. */
    password?: string;
  };
}

const ALL_MODULE_KEYS = [
  "dashboard",
  "daily_brief",
  "comms",
  "travel",
  "budgets",
  "cash_flow",
  "projects",
  "contacts",
  "calendar",
];

const DEFAULTS = new Set(["dashboard", "daily_brief", "comms"]);
const REQUIRED = new Set(["dashboard", "comms"]);

export async function POST(request: Request) {
  const cookieStore = cookies();
  const anon = createServerClient(
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

  // Verify caller
  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: membership } = await anon
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  const callerRole = (membership as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "owner") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Parse + validate
  const body = (await request.json()) as Body;
  // Normalize: prefer orgIds, fall back to orgId. Empty arrays aren't useful —
  // an executive needs at least one principal account to sign into.
  const orgIds: string[] = Array.isArray(body.orgIds) && body.orgIds.length > 0
    ? body.orgIds
    : body.orgId
      ? [body.orgId]
      : [];
  if (orgIds.length === 0) {
    return NextResponse.json(
      { error: "At least one principal account (orgId) is required" },
      { status: 400 }
    );
  }
  const fullName = body.executive?.fullName?.trim();
  const email = body.executive?.email?.trim();
  const password = body.executive?.password;
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!email || !/@/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password !== undefined && password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Service-role client
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Confirm every requested org exists. Catches typos / stale URLs before we
  // touch the auth table.
  const { data: orgRows, error: orgErr } = await service
    .from("organizations")
    .select("id")
    .in("id", orgIds);
  if (orgErr) {
    return NextResponse.json(
      { error: `Principal account lookup failed: ${orgErr.message}` },
      { status: 500 }
    );
  }
  const foundOrgIds = new Set((orgRows ?? []).map((o: { id: string }) => o.id));
  const missing = orgIds.filter((id) => !foundOrgIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Principal account(s) not found: ${missing.join(", ")}` },
      { status: 404 }
    );
  }

  // Look up by email — reuse existing profile if the person is already on the
  // platform (e.g. an executive on another org, or a delegate being promoted).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = service as any;
  const { data: existingProfile } = await svc
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  let executiveId: string;
  if (existingProfile?.id) {
    executiveId = existingProfile.id;
    // If the admin supplied a password while attaching an existing user,
    // honor that — they may be locking down access to a previously
    // magic-link-only account.
    if (password) {
      const { error: pwErr } = await service.auth.admin.updateUserById(
        existingProfile.id,
        { password }
      );
      if (pwErr) {
        return NextResponse.json(
          { error: `Failed to set password: ${pwErr.message}` },
          { status: 500 }
        );
      }
    }
  } else {
    // Create auth user. If a password is provided, the executive can sign in
    // immediately with email + password. If not, they'll receive a magic-link
    // confirmation email and set their own.
    const createPayload: Parameters<typeof service.auth.admin.createUser>[0] = {
      email,
      email_confirm: !!password,
      user_metadata: { full_name: fullName },
    };
    if (password) createPayload.password = password;
    const { data: created, error: createErr } = await service.auth.admin.createUser(
      createPayload
    );
    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: `Failed to create executive: ${createErr?.message}` },
        { status: 500 }
      );
    }
    executiveId = created.user.id;

    // Profile row
    await svc.from("profiles").upsert({
      id: executiveId,
      email,
      full_name: fullName,
      phone: body.executive.phone?.trim() || null,
      status: "active",
      has_seen_welcome: false,
      invited_by: user.id,
    });
  }

  // Attach to each requested org as executive (idempotent — promote if they
  // were on the org with a different role, e.g. delegate).
  for (const targetOrgId of orgIds) {
    const { data: existingMember } = await svc
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", targetOrgId)
      .eq("user_id", executiveId)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.role !== "executive") {
        await svc
          .from("organization_members")
          .update({ role: "executive", status: "active" })
          .eq("id", existingMember.id);
      }
    } else {
      const { error: memberErr } = await svc.from("organization_members").insert({
        organization_id: targetOrgId,
        user_id: executiveId,
        role: "executive",
        status: "active",
      });
      if (memberErr) {
        return NextResponse.json(
          { error: `Failed to attach executive to ${targetOrgId}: ${memberErr.message}` },
          { status: 500 }
        );
      }
    }

    // Seed default module visibility per (org, executive) pair if the rows
    // don't exist yet — re-attaching never overwrites existing config.
    const { data: existingConfig } = await svc
      .from("principal_module_config")
      .select("module_key")
      .eq("organization_id", targetOrgId)
      .eq("principal_id", executiveId);
    const haveConfig = new Set(
      (existingConfig ?? []).map((r: { module_key: string }) => r.module_key)
    );
    const missingRows = ALL_MODULE_KEYS.filter((k) => !haveConfig.has(k)).map(
      (key, idx) => ({
        organization_id: targetOrgId,
        principal_id: executiveId,
        module_key: key,
        is_visible: REQUIRED.has(key) || DEFAULTS.has(key),
        position: idx,
        updated_by: user.id,
      })
    );
    if (missingRows.length > 0) {
      await svc.from("principal_module_config").insert(missingRows);
    }

    // Audit per attachment
    await svc.from("audit_log").insert({
      organization_id: targetOrgId,
      user_id: user.id,
      action: "executive.added",
      metadata: { executive_id: executiveId, executive_email: email },
    });
  }

  return NextResponse.json({ success: true, userId: executiveId });
}
