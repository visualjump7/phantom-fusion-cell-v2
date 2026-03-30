import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface DelegateUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  assigned_assets: {
    id: string;
    name: string;
    category: string;
  }[];
  granted_by_name: string | null;
  granted_at: string;
}

// ============================================
// Query Functions
// ============================================

export async function fetchDelegates(orgId: string): Promise<DelegateUser[]> {
  // Get all delegate members for this org
  const { data: members, error } = await db
    .from("organization_members")
    .select("user_id, status, created_at, profiles!user_id(id, full_name, email)")
    .eq("organization_id", orgId)
    .eq("role", "delegate");

  if (error || !members) {
    console.error("Error fetching delegates:", error);
    return [];
  }

  // Get all delegate asset access for this org
  const { data: allAccess } = await db
    .from("delegate_asset_access")
    .select("user_id, asset_id, granted_by, granted_at, assets!asset_id(id, name, category), profiles!granted_by(full_name)")
    .eq("organization_id", orgId);

  const accessByUser = new Map<string, any[]>();
  (allAccess || []).forEach((a: any) => {
    const list = accessByUser.get(a.user_id) || [];
    list.push(a);
    accessByUser.set(a.user_id, list);
  });

  return members.map((m: any) => {
    const profile = m.profiles || {};
    const userAccess = accessByUser.get(m.user_id) || [];
    return {
      id: m.user_id,
      user_id: m.user_id,
      email: profile.email || "",
      full_name: profile.full_name || "",
      status: m.status || "active",
      assigned_assets: userAccess.map((a: any) => ({
        id: a.assets?.id || a.asset_id,
        name: a.assets?.name || "Unknown",
        category: a.assets?.category || "",
      })),
      granted_by_name: userAccess[0]?.profiles?.full_name || null,
      granted_at: userAccess[0]?.granted_at || m.created_at,
    };
  });
}

export async function fetchDelegateAssetIds(userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("delegate_asset_access")
    .select("asset_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching delegate asset IDs:", error);
    return [];
  }

  return (data || []).map((d: any) => d.asset_id);
}

// ============================================
// Mutations
// ============================================

export async function inviteDelegate(data: {
  orgId: string;
  email: string;
  fullName: string;
  assetIds: string[];
  grantedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already exists in profiles by email
    const { data: existingProfiles } = await db
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .limit(1);

    let userId: string;

    if (existingProfiles && existingProfiles.length > 0) {
      userId = existingProfiles[0].id;
    } else {
      // Create a profile record (user will set password on first login)
      // For now, create a placeholder profile
      const { data: newProfile, error: profileError } = await db
        .from("profiles")
        .insert({
          email: data.email,
          full_name: data.fullName,
          status: "invited",
        })
        .select("id")
        .single();

      if (profileError) {
        return { success: false, error: `Failed to create profile: ${profileError.message}` };
      }
      userId = newProfile.id;
    }

    // Check if already a member
    const { data: existingMember } = await db
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      // Update role to delegate
      await db
        .from("organization_members")
        .update({ role: "delegate", status: "active" })
        .eq("user_id", userId)
        .eq("organization_id", data.orgId);
    } else {
      // Create org membership
      const { error: memberError } = await db
        .from("organization_members")
        .insert({
          user_id: userId,
          organization_id: data.orgId,
          role: "delegate",
          status: "invited",
        });

      if (memberError) {
        return { success: false, error: `Failed to create membership: ${memberError.message}` };
      }
    }

    // Create delegate asset access records
    if (data.assetIds.length > 0) {
      const accessRows = data.assetIds.map((assetId) => ({
        user_id: userId,
        asset_id: assetId,
        organization_id: data.orgId,
        granted_by: data.grantedBy,
      }));

      const { error: accessError } = await db
        .from("delegate_asset_access")
        .upsert(accessRows, { onConflict: "user_id,asset_id" });

      if (accessError) {
        return { success: false, error: `Failed to set access: ${accessError.message}` };
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateDelegateAccess(
  userId: string,
  orgId: string,
  assetIds: string[]
): Promise<boolean> {
  // Delete all existing access for this user in this org
  const { error: deleteError } = await db
    .from("delegate_asset_access")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  if (deleteError) {
    console.error("Error clearing delegate access:", deleteError);
    return false;
  }

  // Insert new access records
  if (assetIds.length > 0) {
    const { data: { user } } = await supabase.auth.getUser();
    const accessRows = assetIds.map((assetId) => ({
      user_id: userId,
      asset_id: assetId,
      organization_id: orgId,
      granted_by: user?.id || null,
    }));

    const { error: insertError } = await db
      .from("delegate_asset_access")
      .insert(accessRows);

    if (insertError) {
      console.error("Error setting delegate access:", insertError);
      return false;
    }
  }

  return true;
}

export async function assignByCategory(
  userId: string,
  orgId: string,
  category: string
): Promise<boolean> {
  const { data: assets } = await db
    .from("assets")
    .select("id")
    .eq("organization_id", orgId)
    .eq("category", category)
    .eq("is_deleted", false);

  const assetIds = (assets || []).map((a: any) => a.id);
  return updateDelegateAccess(userId, orgId, assetIds);
}

export async function assignAll(userId: string, orgId: string): Promise<boolean> {
  const { data: assets } = await db
    .from("assets")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_deleted", false);

  const assetIds = (assets || []).map((a: any) => a.id);
  return updateDelegateAccess(userId, orgId, assetIds);
}

export async function removeDelegate(userId: string, orgId: string): Promise<boolean> {
  // Delete access records
  await db
    .from("delegate_asset_access")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  // Delete org membership
  const { error } = await db
    .from("organization_members")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("role", "delegate");

  if (error) {
    console.error("Error removing delegate:", error);
    return false;
  }
  return true;
}

// ============================================
// Query Helper
// ============================================

export function scopeQueryForDelegate(
  query: any,
  role: string | null,
  assignedAssetIds: string[],
  assetIdColumn: string = "asset_id"
): any {
  if (role !== "delegate" || assignedAssetIds.length === 0) return query;
  return query.in(assetIdColumn, assignedAssetIds);
}
