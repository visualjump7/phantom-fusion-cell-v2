/**
 * GET /api/admin/list-executives?orgId=<uuid>   — single-org roster
 * GET /api/admin/list-executives                — global roster (every org)
 *
 * Service-role read so RLS / role-restrictive policies can't hide rows the
 * admin needs to see. Returns the same shape used by the per-account and
 * global executives pages.
 *
 * Admin / owner only — checked against the caller's memberships.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface ExecutiveDTO {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

interface ExecutiveRosterDTO extends ExecutiveDTO {
  accounts: { orgId: string; displayName: string }[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");

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

  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: memberships } = await anon
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id);
  const roles = ((memberships ?? []) as { role: string }[]).map((m) => m.role);
  const isAdmin = roles.some((r) => r === "admin" || r === "owner");
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 501 }
    );
  }
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = service as any;

  // Pull the membership rows. Filter by org if specified.
  const baseSelect = "user_id, organization_id, status, joined_at";
  const memberQuery = svc
    .from("organization_members")
    .select(baseSelect)
    .eq("role", "executive");
  const { data: members, error: memErr } = orgId
    ? await memberQuery.eq("organization_id", orgId)
    : await memberQuery;
  if (memErr) {
    console.error("[list-executives] members error", memErr);
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const rows = (members ?? []) as {
    user_id: string;
    organization_id: string;
    status: string | null;
    joined_at: string | null;
  }[];

  if (rows.length === 0) {
    return NextResponse.json({
      executives: [],
      mode: orgId ? "single" : "global",
    });
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const orgIds = [...new Set(rows.map((r) => r.organization_id))];

  const [profilesRes, clientProfilesRes] = await Promise.all([
    svc.from("profiles").select("id, full_name, email, phone").in("id", userIds),
    orgIds.length > 0
      ? svc
          .from("client_profiles")
          .select("organization_id, display_name")
          .in("organization_id", orgIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map<
    string,
    { full_name: string | null; email: string | null; phone: string | null }
  >();
  (profilesRes.data ?? []).forEach(
    (p: { id: string; full_name: string | null; email: string | null; phone: string | null }) =>
      profileById.set(p.id, p)
  );

  const orgNameById = new Map<string, string>();
  (clientProfilesRes.data ?? []).forEach(
    (c: { organization_id: string; display_name: string }) =>
      orgNameById.set(c.organization_id, c.display_name)
  );

  if (orgId) {
    // Single-org shape — one row per executive
    const executives: ExecutiveDTO[] = userIds.map((id) => {
      const profile = profileById.get(id);
      const member = rows.find((r) => r.user_id === id)!;
      return {
        userId: id,
        fullName: profile?.full_name || profile?.email || "Unnamed executive",
        email: profile?.email || "",
        phone: profile?.phone || null,
        status: member.status || "active",
        createdAt: member.joined_at || new Date().toISOString(),
      };
    });
    executives.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return NextResponse.json({ executives, mode: "single" });
  }

  // Global shape — one row per executive with the list of accounts they're on
  const accountsByUser = new Map<
    string,
    { orgId: string; displayName: string }[]
  >();
  for (const r of rows) {
    const list = accountsByUser.get(r.user_id) ?? [];
    list.push({
      orgId: r.organization_id,
      displayName: orgNameById.get(r.organization_id) || "Unnamed account",
    });
    accountsByUser.set(r.user_id, list);
  }

  const firstByUser = new Map<string, { status: string; joined_at: string }>();
  for (const r of rows) {
    const existing = firstByUser.get(r.user_id);
    if (
      !existing ||
      (r.joined_at && r.joined_at < existing.joined_at)
    ) {
      firstByUser.set(r.user_id, {
        status: r.status || "active",
        joined_at: r.joined_at || new Date().toISOString(),
      });
    }
  }

  const roster: ExecutiveRosterDTO[] = userIds.map((id) => {
    const profile = profileById.get(id);
    const first = firstByUser.get(id);
    return {
      userId: id,
      fullName: profile?.full_name || profile?.email || "Unnamed executive",
      email: profile?.email || "",
      phone: profile?.phone || null,
      status: first?.status || "active",
      createdAt: first?.joined_at || new Date().toISOString(),
      accounts: (accountsByUser.get(id) ?? []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
    };
  });
  roster.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return NextResponse.json({ executives: roster, mode: "global" });
}
