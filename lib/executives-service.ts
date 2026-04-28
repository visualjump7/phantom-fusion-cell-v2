/**
 * Executives service.
 *
 * "Principal account" is the organization. "Executives" are the humans who
 * log in to that account. There can be many executives per principal, and
 * each one has independent view config (which modules / summary cards they
 * see) managed from /admin/client/[orgId]/principal-experience.
 *
 * Schema-wise, executives are `organization_members` rows with role =
 * 'executive'. The visibility config tables (principal_module_config,
 * principal_summary_config) already key on (org_id, principal_id) — where
 * `principal_id` is the executive's user_id. No migration needed; this
 * service just adds the missing read/add/remove API.
 *
 * Add flow goes through /api/admin/add-executive because creating an auth
 * user requires the service role key.
 */

import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Executive {
  /** Auth user id — same as the row's user_id and the principal_id used by
   *  visibility config tables. */
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  /** organization_members.status — 'active' | 'invited' | 'inactive' etc. */
  status: string;
  createdAt: string;
}

// ============================================
// Read
// ============================================

export async function fetchExecutives(orgId: string): Promise<Executive[]> {
  const { data: members, error } = await db
    .from("organization_members")
    .select("user_id, status, created_at")
    .eq("organization_id", orgId)
    .eq("role", "executive");

  if (error || !members || members.length === 0) {
    if (error) console.error("[fetchExecutives]", error);
    return [];
  }

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", userIds);

  const profileById = new Map<string, { full_name: string | null; email: string | null; phone: string | null }>();
  (profiles ?? []).forEach((p: { id: string; full_name: string | null; email: string | null; phone: string | null }) =>
    profileById.set(p.id, p)
  );

  return members
    .map((m: { user_id: string; status: string; created_at: string }) => {
      const p = profileById.get(m.user_id);
      return {
        userId: m.user_id,
        fullName: p?.full_name || p?.email || "Unnamed executive",
        email: p?.email || "",
        phone: p?.phone || null,
        status: m.status || "active",
        createdAt: m.created_at,
      };
    })
    .sort((a: Executive, b: Executive) => a.fullName.localeCompare(b.fullName));
}

// ============================================
// Write
// ============================================

/**
 * Adds a new executive to a single principal account. Per-account flow used
 * by /admin/client/[orgId]/executives. Returns the new user_id so the caller
 * can deep-link to view config immediately.
 */
export async function addExecutive(
  orgId: string,
  input: { fullName: string; email: string; phone?: string }
): Promise<
  | { success: true; userId: string }
  | { success: false; error: string }
> {
  return addExecutiveCore({
    orgIds: [orgId],
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
  });
}

/**
 * Global add — used by /admin/executive-team. Lets the admin pick multiple
 * principal accounts at once and optionally set a password directly so the
 * executive can sign in with email + password instead of a magic link.
 */
export async function addExecutiveGlobal(input: {
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  orgIds: string[];
}): Promise<
  | { success: true; userId: string }
  | { success: false; error: string }
> {
  if (!input.orgIds || input.orgIds.length === 0) {
    return { success: false, error: "Pick at least one principal account." };
  }
  return addExecutiveCore(input);
}

async function addExecutiveCore(input: {
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  orgIds: string[];
}): Promise<
  | { success: true; userId: string }
  | { success: false; error: string }
> {
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  if (!fullName) return { success: false, error: "Full name is required." };
  if (!email || !/@/.test(email)) {
    return { success: false, error: "A valid email is required." };
  }
  if (input.password !== undefined && input.password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }
  try {
    const res = await fetch("/api/admin/add-executive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgIds: input.orgIds,
        executive: {
          fullName,
          email,
          phone: input.phone?.trim() || undefined,
          password: input.password || undefined,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Couldn't add executive." };
    }
    return { success: true, userId: json.userId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update an executive's profile (name / email / phone). Email changes hit
 * auth.users via the server route so they keep working at sign-in.
 */
export async function updateExecutiveProfile(
  userId: string,
  patch: { fullName?: string; email?: string; phone?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/update-executive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Couldn't update executive." };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================
// Global roster
// ============================================

export interface ExecutiveRoster extends Executive {
  /** Principal accounts (orgs) the executive currently belongs to. */
  accounts: { orgId: string; displayName: string }[];
}

/**
 * Returns every executive across every principal account, with the list of
 * accounts they belong to. Used by the /admin/executive-team page.
 */
export async function fetchAllExecutives(): Promise<ExecutiveRoster[]> {
  const { data: members, error } = await db
    .from("organization_members")
    .select("user_id, organization_id, status, created_at")
    .eq("role", "executive");
  if (error || !members) {
    if (error) console.error("[fetchAllExecutives] members", error);
    return [];
  }

  const userIds = [
    ...new Set(members.map((m: { user_id: string }) => m.user_id)),
  ] as string[];
  const orgIds = [
    ...new Set(members.map((m: { organization_id: string }) => m.organization_id)),
  ] as string[];
  if (userIds.length === 0) return [];

  const [profilesRes, clientProfilesRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email, phone")
      .in("id", userIds),
    orgIds.length > 0
      ? db
          .from("client_profiles")
          .select("organization_id, display_name")
          .in("organization_id", orgIds)
      : Promise.resolve({ data: [] as { organization_id: string; display_name: string }[] }),
  ]);

  const profileById = new Map<
    string,
    { full_name: string | null; email: string | null; phone: string | null }
  >();
  (profilesRes.data ?? []).forEach((p: { id: string; full_name: string | null; email: string | null; phone: string | null }) =>
    profileById.set(p.id, p)
  );
  const orgNameById = new Map<string, string>();
  (clientProfilesRes.data ?? []).forEach(
    (c: { organization_id: string; display_name: string }) =>
      orgNameById.set(c.organization_id, c.display_name)
  );

  // Group memberships by user
  const accountsByUser = new Map<string, { orgId: string; displayName: string }[]>();
  for (const m of members as {
    user_id: string;
    organization_id: string;
  }[]) {
    const list = accountsByUser.get(m.user_id) ?? [];
    list.push({
      orgId: m.organization_id,
      displayName: orgNameById.get(m.organization_id) || "Unnamed account",
    });
    accountsByUser.set(m.user_id, list);
  }

  // Pick the earliest membership row per user for status / createdAt — tweaks
  // are minor; we just need a stable representative row.
  const firstByUser = new Map<string, { status: string; created_at: string }>();
  for (const m of members as {
    user_id: string;
    status: string;
    created_at: string;
  }[]) {
    const existing = firstByUser.get(m.user_id);
    if (!existing || (m.created_at && m.created_at < existing.created_at)) {
      firstByUser.set(m.user_id, { status: m.status, created_at: m.created_at });
    }
  }

  const roster: ExecutiveRoster[] = userIds.map((id) => {
    const profile = profileById.get(id);
    const first = firstByUser.get(id);
    return {
      userId: id,
      fullName: profile?.full_name || profile?.email || "Unnamed executive",
      email: profile?.email || "",
      phone: profile?.phone || null,
      status: first?.status || "active",
      createdAt: first?.created_at || new Date().toISOString(),
      accounts: (accountsByUser.get(id) ?? []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
    };
  });

  return roster.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Sync the set of principal accounts an executive belongs to. Adds them to
 * any new orgs (with default module config) and removes them from any orgs
 * that aren't in the desired set (cleaning up that org's view config rows).
 *
 * Adds go through the server route so we can seed module config consistently;
 * removes are direct deletes (RLS allows admins).
 */
export async function setExecutiveAccountAccess(
  userId: string,
  desiredOrgIds: string[],
  /** Profile data to forward to add-executive when attaching to new orgs. */
  profileForAdd: { fullName: string; email: string; phone?: string }
): Promise<{ success: boolean; error?: string }> {
  // Get current orgs
  const { data: current, error: curErr } = await db
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "executive");
  if (curErr) {
    console.error("[setExecutiveAccountAccess] read", curErr);
    return { success: false, error: curErr.message };
  }
  const currentSet = new Set(
    (current ?? []).map((r: { organization_id: string }) => r.organization_id)
  );
  const desiredSet = new Set(desiredOrgIds);

  const toAdd = desiredOrgIds.filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !desiredSet.has(id as string)) as string[];

  if (toAdd.length > 0) {
    const res = await addExecutiveCore({
      orgIds: toAdd,
      fullName: profileForAdd.fullName,
      email: profileForAdd.email,
      phone: profileForAdd.phone,
    });
    if (!res.success) return { success: false, error: res.error };
  }

  for (const orgId of toRemove) {
    const r = await removeExecutive(userId, orgId);
    if (!r.success) return { success: false, error: r.error };
  }

  return { success: true };
}

/**
 * Removes an executive from a principal account. Drops the organization_members
 * row and cleans up their per-person visibility config. The auth.users row is
 * left intact — the person may belong to other orgs (e.g. as a delegate).
 */
export async function removeExecutive(
  userId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  // Wipe per-person config first so the membership delete is the last step.
  // If the config deletes fail, the membership stays and we surface an error.
  const { error: modErr } = await db
    .from("principal_module_config")
    .delete()
    .eq("organization_id", orgId)
    .eq("principal_id", userId);
  if (modErr) {
    console.error("[removeExecutive] module_config", modErr);
    return { success: false, error: modErr.message };
  }

  const { error: sumErr } = await db
    .from("principal_summary_config")
    .delete()
    .eq("organization_id", orgId)
    .eq("principal_id", userId);
  if (sumErr) {
    console.error("[removeExecutive] summary_config", sumErr);
    return { success: false, error: sumErr.message };
  }

  const { error: memberErr } = await db
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("role", "executive");
  if (memberErr) {
    console.error("[removeExecutive] membership", memberErr);
    return { success: false, error: memberErr.message };
  }

  return { success: true };
}
