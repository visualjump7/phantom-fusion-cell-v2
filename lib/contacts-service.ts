import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export type ContactCategory =
  | "attorney"
  | "broker"
  | "crew"
  | "property_manager"
  | "household_staff"
  | "medical"
  | "security"
  | "vendor"
  | "family"
  | "other";

export interface LinkedAsset {
  assetId: string;
  assetName: string;
}

export interface Contact {
  id: string;
  block_id: string | null;
  organization_id: string;
  contact_type: "personnel" | "subcontractor" | null;
  contact_category: ContactCategory | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  company_name: string | null;
  trade: string | null;
  is_global: boolean;
  notes: string | null;
  linkedAssets: LinkedAsset[];
  created_at: string;
}

export interface FetchContactsOptions {
  contactType?: "personnel" | "subcontractor";
  contactCategory?: ContactCategory;
  search?: string;
  assetId?: string;
  onlyGlobal?: boolean;
}

// ============================================
// Fetch
// ============================================

export async function fetchAllContacts(
  orgId: string,
  options: FetchContactsOptions = {}
): Promise<Contact[]> {
  let q = db
    .from("project_contacts")
    .select(
      "id, block_id, organization_id, contact_type, contact_category, is_global, name, email, phone, role, company_name, trade, notes, created_at"
    )
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (options.onlyGlobal) q = q.eq("is_global", true);
  if (options.contactType) q = q.eq("contact_type", options.contactType);
  if (options.contactCategory) q = q.eq("contact_category", options.contactCategory);

  const { data: raw, error } = await q;
  if (error) {
    console.error("[fetchAllContacts]", error);
    return [];
  }

  const rows = (raw || []) as Array<Contact & { block_id: string | null }>;

  // Resolve linkedAssets for rows that have a block_id
  const blockIds = Array.from(
    new Set(rows.map((r) => r.block_id).filter((b): b is string => !!b))
  );
  const assetByBlock = new Map<string, { assetId: string; assetName: string }>();

  if (blockIds.length > 0) {
    const { data: blocks } = await db
      .from("project_blocks")
      .select("id, asset_id")
      .in("id", blockIds);
    const assetIds = Array.from(
      new Set((blocks || []).map((b: { asset_id: string }) => b.asset_id))
    ) as string[];
    const { data: assets } = assetIds.length
      ? await db.from("assets").select("id, name").in("id", assetIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map<string, string>(
      (assets || []).map((a: { id: string; name: string }) => [a.id, a.name])
    );
    (blocks || []).forEach((b: { id: string; asset_id: string }) => {
      assetByBlock.set(b.id, {
        assetId: b.asset_id,
        assetName: nameById.get(b.asset_id) || "Unknown",
      });
    });
  }

  let results: Contact[] = rows.map((r) => ({
    ...r,
    linkedAssets: r.block_id && assetByBlock.has(r.block_id) ? [assetByBlock.get(r.block_id)!] : [],
  }));

  if (options.assetId) {
    results = results.filter((c) =>
      c.linkedAssets.some((la) => la.assetId === options.assetId)
    );
  }

  if (options.search) {
    const q = options.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.company_name && c.company_name.toLowerCase().includes(q)) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        (c.trade && c.trade.toLowerCase().includes(q))
    );
  }

  return results;
}

export async function fetchGlobalContacts(orgId: string): Promise<Contact[]> {
  return fetchAllContacts(orgId, { onlyGlobal: true });
}

// ============================================
// Create / update / delete
// ============================================

export interface CreateGlobalContactInput {
  name: string;
  role?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  contact_category?: ContactCategory;
  notes?: string;
}

export async function createGlobalContact(
  orgId: string,
  data: CreateGlobalContactInput
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("project_contacts").insert({
    organization_id: orgId,
    block_id: null,
    is_global: true,
    contact_type: null,
    contact_category: data.contact_category || "other",
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    role: data.role || null,
    company_name: data.company_name || null,
    notes: data.notes || null,
  });
  if (error) {
    console.error("[createGlobalContact]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function updateContact(
  id: string,
  patch: Partial<CreateGlobalContactInput>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("project_contacts")
    .update(patch)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteContact(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("project_contacts").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================
// Category metadata
// ============================================

export const CONTACT_CATEGORIES: { value: ContactCategory; label: string }[] = [
  { value: "attorney", label: "Attorney" },
  { value: "broker", label: "Broker" },
  { value: "crew", label: "Crew" },
  { value: "property_manager", label: "Property manager" },
  { value: "household_staff", label: "Household staff" },
  { value: "medical", label: "Medical" },
  { value: "security", label: "Security" },
  { value: "vendor", label: "Vendor" },
  { value: "family", label: "Family" },
  { value: "other", label: "Other" },
];
