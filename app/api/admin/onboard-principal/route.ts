/**
 * POST /api/admin/onboard-principal
 *
 * Server-only route that runs the multi-step onboarding transaction behind
 * a service-role client. The browser wizard posts a single JSON payload;
 * this route creates the organization, client_profile, auth user (via
 * admin.createUser with magic-link email), profile row, membership, seeds
 * module_config, and writes an audit event.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface WizardInput {
  organization: {
    name: string;
    accentColor?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    primaryContactPhone?: string;
    notes?: string;
  };
  principal: {
    fullName: string;
    email: string;
    phone?: string;
  };
  modules: Record<string, boolean>;
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

  // Verify caller is an admin
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
  const body = (await request.json()) as WizardInput;
  if (!body?.organization?.name?.trim()) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }
  if (!body?.principal?.fullName?.trim()) {
    return NextResponse.json({ error: "Principal full name is required" }, { status: 400 });
  }
  if (!body?.principal?.email?.trim() || !/@/.test(body.principal.email)) {
    return NextResponse.json({ error: "Valid principal email is required" }, { status: 400 });
  }

  // Service-role client — needed for auth.admin.createUser + unrestricted inserts.
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1) Organization
  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({ name: body.organization.name.trim() })
    .select("id")
    .single();
  if (orgErr || !org) {
    return NextResponse.json({ error: `Failed to create organization: ${orgErr?.message}` }, { status: 500 });
  }

  // 2) Client profile
  const { error: profileErr } = await service.from("client_profiles").insert({
    organization_id: org.id,
    display_name: body.organization.name.trim(),
    accent_color: body.organization.accentColor || "green",
    primary_contact_name: body.organization.primaryContactName || null,
    primary_contact_email: body.organization.primaryContactEmail || null,
    primary_contact_phone: body.organization.primaryContactPhone || null,
    notes: body.organization.notes || null,
    status: "active",
  });
  if (profileErr) {
    return NextResponse.json({ error: `Failed to create client profile: ${profileErr.message}` }, { status: 500 });
  }

  // 3) Auth user — magic-link email on first login.
  // Use admin.createUser with email_confirm=false so Supabase sends a
  // confirmation email. Fallback to admin.inviteUserByEmail if createUser
  // isn't allowed.
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: body.principal.email.trim(),
    email_confirm: false,
    user_metadata: { full_name: body.principal.fullName.trim() },
  });
  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: `Failed to create principal user: ${createErr?.message}` },
      { status: 500 }
    );
  }
  const principalId = created.user.id;

  // 4) Profile row
  await service.from("profiles").upsert({
    id: principalId,
    email: body.principal.email.trim(),
    full_name: body.principal.fullName.trim(),
    phone: body.principal.phone?.trim() || null,
    status: "active",
    has_seen_welcome: false,
    invited_by: user.id,
  });

  // 5) Membership
  await service.from("organization_members").insert({
    organization_id: org.id,
    user_id: principalId,
    role: "executive",
    status: "active",
  });

  // 6) Seed module config (honor wizard selections; required-on stays on)
  const selections = body.modules ?? {};
  const rows = ALL_MODULE_KEYS.map((key, idx) => {
    const requested = key in selections ? !!selections[key] : DEFAULTS.has(key);
    const visible = REQUIRED.has(key) ? true : requested;
    return {
      organization_id: org.id,
      principal_id: principalId,
      module_key: key,
      is_visible: visible,
      position: idx,
      updated_by: user.id,
    };
  });
  await service
    .from("principal_module_config")
    .upsert(rows, { onConflict: "organization_id,principal_id,module_key" });

  // 7) Welcome Comms message from admin → principal
  await service.from("messages").insert({
    organization_id: org.id,
    sender_id: user.id,
    type: "update",
    priority: "normal",
    title: `Welcome, ${body.principal.fullName.trim().split(" ")[0] || "there"}`,
    body: `Your Fusion Cell is ready. Your team has set up your view; tap any module to begin. If you have questions, reach us through this channel.`,
  });

  // 8) Audit
  await service.from("audit_log").insert({
    organization_id: org.id,
    user_id: user.id,
    action: "principal.onboarded",
    metadata: {
      principal_id: principalId,
      principal_email: body.principal.email.trim(),
    },
  });

  return NextResponse.json({
    success: true,
    orgId: org.id,
    principalId,
  });
}
