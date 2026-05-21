/**
 * Server-side auth helpers for API routes.
 *
 * Standardizes the two patterns we use across `/app/api/**`:
 *
 *   requireUser(supabase)           — returns the signed-in user or a 401 response
 *   requireAdmin(supabase)          — caller must be admin/owner anywhere
 *   requireOrgMember(supabase, org) — caller must belong to the given org
 *   requireOrgManager(supabase, org)— caller must be admin/manager/owner of the given org
 *
 * Replaces the fragile `.limit(1).single()` membership check that used to
 * pick an arbitrary row — these helpers scan ALL memberships so a user with
 * multiple orgs (admin somewhere, executive elsewhere) is reliably classified.
 *
 * Each helper returns either { user, ... } on success or { response: Response }
 * on failure — caller pattern:
 *
 *     const gate = await requireAdmin(supabase);
 *     if ("response" in gate) return gate.response;
 *     // gate.user is now the verified admin
 */

import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface User {
  id: string;
  email?: string | null;
  [key: string]: unknown;
}

type GateSuccess<T> = T;
type GateFailure = { response: NextResponse };

const ADMIN_ROLES = new Set(["admin", "owner"]);
const MANAGER_ROLES = new Set(["admin", "owner", "manager"]);

/**
 * Verify the request carries a valid session. Returns the user or a 401.
 */
export async function requireUser(
  supabase: SupabaseClient
): Promise<GateSuccess<{ user: User }> | GateFailure> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * Verify the caller is admin or owner in at least one organization.
 * Returns the user + the orgs they admin, or 401/403.
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<
  GateSuccess<{ user: User; adminOrgIds: string[] }> | GateFailure
> {
  const auth = await requireUser(supabase);
  if ("response" in auth) return auth;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", auth.user.id);

  const rows = (memberships ?? []) as { role: string; organization_id: string }[];
  const adminOrgIds = rows
    .filter((m) => ADMIN_ROLES.has(m.role))
    .map((m) => m.organization_id);

  if (adminOrgIds.length === 0) {
    return {
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, adminOrgIds };
}

/**
 * Verify the caller is a member (any role) of the given organization.
 * Returns the user + their role in that org, or 401/403.
 */
export async function requireOrgMember(
  supabase: SupabaseClient,
  organizationId: string
): Promise<GateSuccess<{ user: User; role: string }> | GateFailure> {
  const auth = await requireUser(supabase);
  if ("response" in auth) return auth;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!membership) {
    return {
      response: NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, role: (membership as { role: string }).role };
}

/**
 * Verify the caller has manager-tier access (admin/owner/manager) on the
 * given organization. Stricter than requireOrgMember (excludes executive,
 * delegate, viewer).
 */
export async function requireOrgManager(
  supabase: SupabaseClient,
  organizationId: string
): Promise<GateSuccess<{ user: User; role: string }> | GateFailure> {
  const gate = await requireOrgMember(supabase, organizationId);
  if ("response" in gate) return gate;

  if (!MANAGER_ROLES.has(gate.role)) {
    return {
      response: NextResponse.json(
        { error: "Manager-level access required" },
        { status: 403 }
      ),
    };
  }

  return gate;
}
