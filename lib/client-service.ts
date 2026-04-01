import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface ClientProfile {
  id: string;
  organization_id: string;
  display_name: string;
  status: "active" | "onboarding" | "paused" | "archived";
  accent_color: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  onboarded_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  allowed_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface ClientSummary {
  orgId: string;
  displayName: string;
  accentColor: string;
  status: string;
  projectsCount: number;
  projectsValue: number;
  pendingBillsCount: number;
  pendingBillsTotal: number;
  unresolvedAlertsCount: number;
}

// ============================================
// Fetch Functions
// ============================================

export async function fetchClientProfiles(): Promise<ClientProfile[]> {
  const { data, error } = await db
    .from("client_profiles")
    .select("*")
    .order("display_name");

  if (error) {
    console.error("Error fetching client profiles:", error);
    return [];
  }

  return data || [];
}

export async function fetchClientProfile(orgId: string): Promise<ClientProfile | null> {
  const { data, error } = await db
    .from("client_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .single();

  if (error) {
    console.error("Error fetching client profile:", error);
    return null;
  }

  return data;
}

export async function fetchClientSummary(orgId: string): Promise<ClientSummary | null> {
  const [profileRes, assetsRes, billsRes, messagesRes] = await Promise.all([
    db.from("client_profiles").select("display_name, accent_color, status").eq("organization_id", orgId).single(),
    db.from("assets").select("id, estimated_value").eq("organization_id", orgId).eq("is_deleted", false),
    db.from("bills").select("amount_cents").eq("organization_id", orgId).eq("status", "pending"),
    db.from("messages").select("id").eq("organization_id", orgId).eq("is_deleted", false).eq("is_archived", false),
  ]);

  if (profileRes.error || !profileRes.data) return null;

  const assets = assetsRes.data || [];
  const bills = billsRes.data || [];
  const messages = messagesRes.data || [];

  return {
    orgId,
    displayName: profileRes.data.display_name,
    accentColor: profileRes.data.accent_color,
    status: profileRes.data.status,
    projectsCount: assets.length,
    projectsValue: assets.reduce((sum: number, a: { estimated_value: number }) => sum + (a.estimated_value || 0), 0),
    pendingBillsCount: bills.length,
    pendingBillsTotal: bills.reduce((sum: number, b: { amount_cents: number }) => sum + b.amount_cents, 0),
    unresolvedAlertsCount: messages.length,
  };
}

export async function fetchAllClientsSummary(): Promise<ClientSummary[]> {
  const profiles = await fetchClientProfiles();
  const summaries = await Promise.all(
    profiles.map((p) => fetchClientSummary(p.organization_id))
  );
  return summaries.filter((s): s is ClientSummary => s !== null);
}

// ============================================
// Mutations
// ============================================

export async function createClientProfile(data: {
  organizationName: string;
  displayName: string;
  accentColor?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  notes?: string;
  allowedCategories?: string[];
}): Promise<{ success: boolean; orgId?: string; error?: string }> {
  // Create the organization first
  const { data: org, error: orgError } = await db
    .from("organizations")
    .insert({ name: data.organizationName })
    .select("id")
    .single();

  if (orgError) return { success: false, error: orgError.message };

  // Create the client profile
  const { error: profileError } = await db
    .from("client_profiles")
    .insert({
      organization_id: org.id,
      display_name: data.displayName,
      accent_color: data.accentColor || "amber",
      primary_contact_name: data.primaryContactName || null,
      primary_contact_email: data.primaryContactEmail || null,
      primary_contact_phone: data.primaryContactPhone || null,
      notes: data.notes || null,
      allowed_categories: data.allowedCategories || ["business", "personal", "family"],
      status: "onboarding",
    });

  if (profileError) return { success: false, error: profileError.message };

  // Add current user as owner of the new org
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await db.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "admin",
      status: "active",
    });
  }

  return { success: true, orgId: org.id };
}

export async function updateClientProfile(
  orgId: string,
  updates: Partial<Pick<ClientProfile, "display_name" | "accent_color" | "status" | "primary_contact_name" | "primary_contact_email" | "primary_contact_phone" | "notes" | "allowed_categories">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("client_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================
// Deletion
// ============================================

export interface DeletionCounts {
  projects: number;
  budgets: number;
  bills: number;
  messages: number;
  members: number;
}

export async function fetchDeletionCounts(orgId: string): Promise<DeletionCounts> {
  const [assetsRes, budgetsRes, billsRes, messagesRes, membersRes] = await Promise.all([
    db.from("assets").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    db.from("budgets").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    db.from("bills").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    db.from("messages").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    db.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);

  return {
    projects: assetsRes.count ?? 0,
    budgets: budgetsRes.count ?? 0,
    bills: billsRes.count ?? 0,
    messages: messagesRes.count ?? 0,
    members: membersRes.count ?? 0,
  };
}

export async function deletePrincipal(orgId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete message_responses for messages in this org
    const { data: orgMessages } = await db
      .from("messages")
      .select("id")
      .eq("organization_id", orgId);
    const msgIds = (orgMessages || []).map((m: { id: string }) => m.id);

    if (msgIds.length > 0) {
      await db.from("message_responses").delete().in("message_id", msgIds);
    }

    // 2. Delete messages
    const { error: msgErr } = await db.from("messages").delete().eq("organization_id", orgId);
    if (msgErr) throw new Error(`Failed to delete messages: ${msgErr.message}`);

    // 3. Delete bill_imports
    await db.from("bill_imports").delete().eq("organization_id", orgId);

    // 4. Delete bills
    const { error: billErr } = await db.from("bills").delete().eq("organization_id", orgId);
    if (billErr) throw new Error(`Failed to delete bills: ${billErr.message}`);

    // 5. Delete budget_line_items via budgets
    const { data: orgBudgets } = await db
      .from("budgets")
      .select("id")
      .eq("organization_id", orgId);
    const budgetIds = (orgBudgets || []).map((b: { id: string }) => b.id);

    if (budgetIds.length > 0) {
      await db.from("budget_line_items").delete().in("budget_id", budgetIds);
    }

    // 6. Delete budgets
    const { error: budgetErr } = await db.from("budgets").delete().eq("organization_id", orgId);
    if (budgetErr) throw new Error(`Failed to delete budgets: ${budgetErr.message}`);

    // 7. Delete assets
    const { error: assetErr } = await db.from("assets").delete().eq("organization_id", orgId);
    if (assetErr) throw new Error(`Failed to delete assets: ${assetErr.message}`);

    // 8. Delete client_profile
    const { error: profileErr } = await db.from("client_profiles").delete().eq("organization_id", orgId);
    if (profileErr) throw new Error(`Failed to delete client profile: ${profileErr.message}`);

    // 9. Delete organization_members
    const { error: memberErr } = await db.from("organization_members").delete().eq("organization_id", orgId);
    if (memberErr) throw new Error(`Failed to delete organization members: ${memberErr.message}`);

    // 10. Delete the organization
    const { error: orgErr } = await db.from("organizations").delete().eq("id", orgId);
    if (orgErr) throw new Error(`Failed to delete organization: ${orgErr.message}`);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during deletion";
    console.error("[deletePrincipal]", message);
    return { success: false, error: message };
  }
}
