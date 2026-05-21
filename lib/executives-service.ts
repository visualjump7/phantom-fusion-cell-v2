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

/**
 * Fetch all executives on a single principal account.
 *
 * Goes through /api/admin/list-executives so the read happens with the
 * service role and isn't subject to RLS quirks. Some Supabase projects have
 * stricter org-scoped RLS than the migrations in this repo show, so doing
 * this client-side directly was returning empty lists even when the rows
 * existed in the DB.
 */
export async function fetchExecutives(orgId: string): Promise<Executive[]> {
  try {
    const res = await fetch(
      `/api/admin/list-executives?orgId=${encodeURIComponent(orgId)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (!res.ok) {
      console.error("[fetchExecutives]", json.error);
      return [];
    }
    return (json.executives ?? []) as Executive[];
  } catch (err) {
    console.error("[fetchExecutives]", err);
    return [];
  }
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
  if (input.password !== undefined && input.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
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
 *
 * Goes through /api/admin/list-executives so it uses the service role —
 * same reasoning as fetchExecutives.
 */
export async function fetchAllExecutives(): Promise<ExecutiveRoster[]> {
  try {
    const res = await fetch("/api/admin/list-executives", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("[fetchAllExecutives]", json.error);
      return [];
    }
    return (json.executives ?? []) as ExecutiveRoster[];
  } catch (err) {
    console.error("[fetchAllExecutives]", err);
    return [];
  }
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
