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
  // Look across every membership the caller has — not just the first one we
  // happen to read. With multiple memberships, .limit(1).single() returns an
  // arbitrary row and may pick a non-admin role even when the caller is admin
  // somewhere else.
  const { data: memberships } = await anon
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id);
  const roles = ((memberships ?? []) as { role: string }[]).map((m) => m.role);
  const isAdmin = roles.some((r) => r === "admin" || r === "owner");
  if (!isAdmin) {
    console.warn("[add-executive] non-admin caller", {
      userId: user.id,
      roles,
    });
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
  if (password !== undefined && password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Service-role client. The key is required — without it, auth.admin.* calls
  // and RLS-bypassing inserts fail. Surface a clear message instead of going
  // ahead with a broken client and reporting cryptic downstream errors.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[add-executive] SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local and restart the dev server.",
      },
      { status: 501 }
    );
  }
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  console.log("[add-executive] start", {
    callerId: user.id,
    email,
    orgIds,
    hasPassword: !!password,
  });

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
    // Create auth user. Two paths:
    //   - With password: admin.createUser({email_confirm:true, password})
    //     so the executive can sign in immediately with email + password.
    //   - Without password: admin.inviteUserByEmail — Supabase deterministically
    //     sends an invite email, the user clicks the link, lands in
    //     /auth/reset, sets their own password. This is the right API for
    //     "invite" flows — createUser({email_confirm:false}) only sometimes
    //     sent the email depending on project signup settings.
    let createdUserId: string | undefined;
    if (password) {
      const { data: created, error: createErr } =
        await service.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
          user_metadata: { full_name: fullName },
        });
      if (createErr || !created?.user) {
        return NextResponse.json(
          { error: `Failed to create executive: ${createErr?.message}` },
          { status: 500 }
        );
      }
      createdUserId = created.user.id;
    } else {
      const { data: invited, error: inviteErr } =
        await service.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName },
        });
      if (inviteErr || !invited?.user) {
        return NextResponse.json(
          { error: `Failed to invite executive: ${inviteErr?.message}` },
          { status: 500 }
        );
      }
      createdUserId = invited.user.id;
    }
    executiveId = createdUserId;

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
        const { error: updErr } = await svc
          .from("organization_members")
          .update({ role: "executive", status: "active" })
          .eq("id", existingMember.id);
        if (updErr) {
          console.error(
            "[add-executive] promote failed",
            { targetOrgId, executiveId, err: updErr.message }
          );
          return NextResponse.json(
            { error: `Failed to promote member: ${updErr.message}` },
            { status: 500 }
          );
        }
      }
    } else {
      const { error: memberErr } = await svc.from("organization_members").insert({
        organization_id: targetOrgId,
        user_id: executiveId,
        role: "executive",
        status: "active",
      });
      if (memberErr) {
        console.error(
          "[add-executive] membership insert failed",
          { targetOrgId, executiveId, err: memberErr.message }
        );
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
      const { error: cfgErr } = await svc
        .from("principal_module_config")
        .insert(missingRows);
      if (cfgErr) {
        // Don't block — view config can be fixed from the Executive View page.
        // But log so we can spot it.
        console.warn(
          "[add-executive] module_config seed failed (continuing)",
          { targetOrgId, executiveId, err: cfgErr.message }
        );
      }
    }

    // Audit per attachment. Tolerated failure — the table may not exist in
    // this environment, and we don't want to block the membership writes.
    try {
      const { error: auditErr } = await svc.from("audit_log").insert({
        organization_id: targetOrgId,
        user_id: user.id,
        action: "executive.added",
        metadata: { executive_id: executiveId, executive_email: email },
      });
      if (auditErr) {
        console.warn("[add-executive] audit_log skipped", auditErr.message);
      }
    } catch (e) {
      console.warn("[add-executive] audit_log threw", e);
    }
  }

  // Verification re-read — confirm the membership rows we expected actually
  // landed before reporting success. Catches silent RLS / trigger weirdness.
  const { data: verifyRows, error: verifyErr } = await svc
    .from("organization_members")
    .select("organization_id, role, status")
    .eq("user_id", executiveId)
    .eq("role", "executive")
    .in("organization_id", orgIds);
  if (verifyErr) {
    console.error("[add-executive] verify failed", verifyErr.message);
    return NextResponse.json(
      { error: `Couldn't verify the new attachment: ${verifyErr.message}` },
      { status: 500 }
    );
  }
  const attachedOrgIds = (verifyRows ?? []).map(
    (r: { organization_id: string }) => r.organization_id
  );
  const notAttached = orgIds.filter((id) => !attachedOrgIds.includes(id));
  if (notAttached.length > 0) {
    console.error("[add-executive] verify mismatch", {
      executiveId,
      requested: orgIds,
      actual: attachedOrgIds,
      notAttached,
    });
    return NextResponse.json(
      {
        error:
          "Executive was created but didn't attach to: " +
          notAttached.join(", ") +
          ". Check organization_members RLS / triggers.",
      },
      { status: 500 }
    );
  }

  console.log("[add-executive] success", {
    executiveId,
    email,
    attachedOrgIds,
  });
  return NextResponse.json({
    success: true,
    userId: executiveId,
    attachedOrgIds,
  });
}
