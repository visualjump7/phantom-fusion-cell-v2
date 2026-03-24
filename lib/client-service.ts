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
  created_at: string;
  updated_at: string;
}

export interface ClientSummary {
  orgId: string;
  displayName: string;
  accentColor: string;
  status: string;
  holdingsCount: number;
  holdingsValue: number;
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
    holdingsCount: assets.length,
    holdingsValue: assets.reduce((sum: number, a: { estimated_value: number }) => sum + (a.estimated_value || 0), 0),
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
      status: "onboarding",
    });

  if (profileError) return { success: false, error: profileError.message };

  // Add current user as owner of the new org
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await db.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    });
  }

  return { success: true, orgId: org.id };
}

export async function updateClientProfile(
  orgId: string,
  updates: Partial<Pick<ClientProfile, "display_name" | "accent_color" | "status" | "primary_contact_name" | "primary_contact_email" | "primary_contact_phone" | "notes">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("client_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
