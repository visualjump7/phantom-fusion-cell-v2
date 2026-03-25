import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  invited_by: string | null;
  created_at: string;
  assignments: { organization_id: string; display_name: string }[];
}

export interface InviteUserData {
  email: string;
  fullName: string;
  role: "admin" | "manager" | "viewer";
  principalOrgIds?: string[];
}

// ============================================
// Fetch Functions
// ============================================

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  // Get all non-executive organization members (also exclude legacy "owner" check —
  // they get normalized below, but "executive" is the only role we truly skip)
  const { data: members, error: memberError } = await db
    .from("organization_members")
    .select("user_id, role, status")
    .neq("role", "executive");

  if (memberError || !members) {
    console.error("[fetchTeamMembers] members error:", memberError);
    return [];
  }

  // Deduplicate by user_id
  const userIds = [...new Set(members.map((m: { user_id: string }) => m.user_id))] as string[];

  if (userIds.length === 0) return [];

  // Get profiles
  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, email, full_name, status, last_login_at, invited_by, created_at")
    .in("id", userIds);

  if (profileError || !profiles) {
    console.error("[fetchTeamMembers] profiles error:", profileError);
    return [];
  }

  // Get principal assignments (plain — no join)
  const { data: rawAssignments } = await db
    .from("principal_assignments")
    .select("user_id, organization_id")
    .in("user_id", userIds);

  // Get display names for assigned orgs from client_profiles
  const assignedOrgIds = [
    ...new Set((rawAssignments || []).map((a: { organization_id: string }) => a.organization_id)),
  ] as string[];

  let orgNameMap: Record<string, string> = {};
  if (assignedOrgIds.length > 0) {
    const { data: clientProfiles } = await db
      .from("client_profiles")
      .select("organization_id, display_name")
      .in("organization_id", assignedOrgIds);

    for (const cp of clientProfiles || []) {
      orgNameMap[cp.organization_id] = cp.display_name;
    }
  }

  // Build result
  return profiles.map((profile: any) => {
    const membership = members.find((m: any) => m.user_id === profile.id);
    // Normalize legacy roles
    let role = membership?.role || "viewer";
    if (role === "owner") role = "admin";
    if (role === "accountant") role = "manager";

    const userAssignments = (rawAssignments || [])
      .filter((a: any) => a.user_id === profile.id)
      .map((a: any) => ({
        organization_id: a.organization_id,
        display_name: orgNameMap[a.organization_id] || "Unknown",
      }));

    return {
      id: profile.id,
      email: profile.email || "",
      full_name: profile.full_name,
      role,
      status: profile.status || "active",
      last_login_at: profile.last_login_at,
      invited_by: profile.invited_by,
      created_at: profile.created_at,
      assignments: userAssignments,
    };
  });
}

// ============================================
// Invite
// ============================================

export async function inviteUser(data: InviteUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) return { success: false, error: result.error || "Failed to invite user" };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ============================================
// Role Management
// ============================================

export async function updateUserRole(
  userId: string,
  newRole: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("organization_members")
    .update({ role: newRole })
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };

  // If changing to admin, clear assignments (admins see all)
  if (newRole === "admin") {
    await db.from("principal_assignments").delete().eq("user_id", userId);
  }

  return { success: true };
}

// ============================================
// Principal Assignments
// ============================================

export async function getUserAssignments(userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("principal_assignments")
    .select("organization_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getUserAssignments]", error);
    return [];
  }

  return (data || []).map((a: { organization_id: string }) => a.organization_id);
}

export async function setUserAssignments(
  userId: string,
  orgIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();

  // Delete existing assignments
  const { error: deleteError } = await db
    .from("principal_assignments")
    .delete()
    .eq("user_id", userId);

  if (deleteError) return { success: false, error: deleteError.message };

  // Insert new assignments
  if (orgIds.length > 0) {
    const rows = orgIds.map((orgId) => ({
      user_id: userId,
      organization_id: orgId,
      assigned_by: user?.id || null,
    }));

    const { error: insertError } = await db
      .from("principal_assignments")
      .insert(rows);

    if (insertError) return { success: false, error: insertError.message };
  }

  return { success: true };
}

// ============================================
// User Status
// ============================================

export async function toggleUserStatus(
  userId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("profiles")
    .update({ status: active ? "active" : "disabled" })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  // Also update organization_members status
  await db
    .from("organization_members")
    .update({ status: active ? "active" : "inactive" })
    .eq("user_id", userId);

  return { success: true };
}

// ============================================
// Remove User
// ============================================

export async function removeUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete principal assignments
    await db.from("principal_assignments").delete().eq("user_id", userId);

    // Delete organization memberships
    const { error: memberError } = await db
      .from("organization_members")
      .delete()
      .eq("user_id", userId);

    if (memberError) throw new Error(memberError.message);

    // Mark profile as disabled (we can't delete auth users from client)
    await db
      .from("profiles")
      .update({ status: "disabled" })
      .eq("id", userId);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove user" };
  }
}
