import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface ProjectBlock {
  id: string;
  asset_id: string;
  organization_id: string;
  type: "gallery" | "personnel" | "subcontractor" | "notes";
  title: string | null;
  position: number;
  config: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contacts?: ProjectContact[];
  images?: ProjectImage[];
}

export interface ProjectContact {
  id: string;
  block_id: string;
  organization_id: string;
  contact_type: "personnel" | "subcontractor";
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: "active" | "on-leave" | "completed" | "terminated";
  notes: string | null;
  position: number;
  role: string | null;
  company: string | null;
  department: string | null;
  company_name: string | null;
  trade: string | null;
  contract_value_cents: number | null;
  contract_start: string | null;
  contract_end: string | null;
  license_number: string | null;
  insurance_on_file: boolean;
  insurance_expiry: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectImage {
  id: string;
  block_id: string;
  organization_id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  taken_at: string | null;
  file_name: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  position: number;
  uploaded_by: string | null;
  created_at: string;
}

// ============================================
// Block Operations
// ============================================

export async function fetchProjectBlocks(assetId: string): Promise<ProjectBlock[]> {
  const { data, error } = await db
    .from("project_blocks")
    .select("*, project_contacts(*), project_images(*)")
    .eq("asset_id", assetId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching project blocks:", error);
    return [];
  }

  return (data || []).map((block: any) => ({
    ...block,
    contacts: (block.project_contacts || []).sort(
      (a: ProjectContact, b: ProjectContact) => a.position - b.position
    ),
    images: (block.project_images || []).sort(
      (a: ProjectImage, b: ProjectImage) => a.position - b.position
    ),
    project_contacts: undefined,
    project_images: undefined,
  }));
}

export async function createBlock(
  assetId: string,
  orgId: string,
  type: ProjectBlock["type"],
  title?: string
): Promise<ProjectBlock | null> {
  const { data: { user } } = await supabase.auth.getUser();

  // Get next position
  const { data: existing } = await db
    .from("project_blocks")
    .select("position")
    .eq("asset_id", assetId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const defaultTitles: Record<string, string> = {
    gallery: "Photo Gallery",
    personnel: "Key Personnel",
    subcontractor: "Subcontractors",
    notes: "Project Notes",
  };

  const { data, error } = await db
    .from("project_blocks")
    .insert({
      asset_id: assetId,
      organization_id: orgId,
      type,
      title: title || defaultTitles[type] || null,
      position: nextPosition,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating block:", error);
    return null;
  }

  return { ...data, contacts: [], images: [] };
}

export async function updateBlock(
  blockId: string,
  updates: Partial<Pick<ProjectBlock, "title" | "config">>
): Promise<boolean> {
  const { error } = await db
    .from("project_blocks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", blockId);

  if (error) {
    console.error("Error updating block:", error);
    return false;
  }
  return true;
}

export async function deleteBlock(blockId: string): Promise<boolean> {
  const { error } = await db.from("project_blocks").delete().eq("id", blockId);
  if (error) {
    console.error("Error deleting block:", error);
    return false;
  }
  return true;
}

export async function reorderBlocks(
  assetId: string,
  blockIds: string[]
): Promise<boolean> {
  const updates = blockIds.map((id, index) =>
    db
      .from("project_blocks")
      .update({ position: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("asset_id", assetId)
  );

  const results = await Promise.all(updates);
  const hasError = results.some((r: any) => r.error);
  if (hasError) {
    console.error("Error reordering blocks");
    return false;
  }
  return true;
}

// ============================================
// Contact Operations
// ============================================

export async function addContact(
  blockId: string,
  orgId: string,
  data: Partial<ProjectContact>
): Promise<ProjectContact | null> {
  // Get next position
  const { data: existing } = await db
    .from("project_contacts")
    .select("position")
    .eq("block_id", blockId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data: created, error } = await db
    .from("project_contacts")
    .insert({
      block_id: blockId,
      organization_id: orgId,
      contact_type: data.contact_type || "personnel",
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      avatar_url: data.avatar_url || null,
      status: data.status || "active",
      notes: data.notes || null,
      position: nextPosition,
      role: data.role || null,
      company: data.company || null,
      department: data.department || null,
      company_name: data.company_name || null,
      trade: data.trade || null,
      contract_value_cents: data.contract_value_cents || null,
      contract_start: data.contract_start || null,
      contract_end: data.contract_end || null,
      license_number: data.license_number || null,
      insurance_on_file: data.insurance_on_file || false,
      insurance_expiry: data.insurance_expiry || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding contact:", error);
    return null;
  }
  return created;
}

export async function updateContact(
  contactId: string,
  updates: Partial<ProjectContact>
): Promise<boolean> {
  const { error } = await db
    .from("project_contacts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", contactId);

  if (error) {
    console.error("Error updating contact:", error);
    return false;
  }
  return true;
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const { error } = await db.from("project_contacts").delete().eq("id", contactId);
  if (error) {
    console.error("Error deleting contact:", error);
    return false;
  }
  return true;
}

export async function reorderContacts(
  blockId: string,
  contactIds: string[]
): Promise<boolean> {
  const updates = contactIds.map((id, index) =>
    db
      .from("project_contacts")
      .update({ position: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("block_id", blockId)
  );

  const results = await Promise.all(updates);
  return !results.some((r: any) => r.error);
}

// ============================================
// Image Operations
// ============================================

export async function uploadImage(
  blockId: string,
  orgId: string,
  assetId: string,
  file: File
): Promise<ProjectImage | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${orgId}/${assetId}/${blockId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("project-images")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.error("Error uploading image:", uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("project-images")
    .getPublicUrl(path);

  // Get next position
  const { data: existing } = await db
    .from("project_images")
    .select("position")
    .eq("block_id", blockId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data: created, error } = await db
    .from("project_images")
    .insert({
      block_id: blockId,
      organization_id: orgId,
      url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      position: nextPosition,
      uploaded_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating image record:", error);
    return null;
  }
  return created;
}

export async function deleteImage(imageId: string): Promise<boolean> {
  const { error } = await db.from("project_images").delete().eq("id", imageId);
  if (error) {
    console.error("Error deleting image:", error);
    return false;
  }
  return true;
}

export async function updateImageCaption(
  imageId: string,
  caption: string
): Promise<boolean> {
  const { error } = await db
    .from("project_images")
    .update({ caption })
    .eq("id", imageId);

  if (error) {
    console.error("Error updating image caption:", error);
    return false;
  }
  return true;
}

export async function reorderImages(
  blockId: string,
  imageIds: string[]
): Promise<boolean> {
  const updates = imageIds.map((id, index) =>
    db
      .from("project_images")
      .update({ position: index })
      .eq("id", id)
      .eq("block_id", blockId)
  );

  const results = await Promise.all(updates);
  return !results.some((r: any) => r.error);
}

// ============================================
// Trade Colors
// ============================================

export const TRADE_COLORS: Record<string, string> = {
  electrical: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  mechanical: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  hvac: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  structural: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  civil: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  environmental: "bg-green-500/15 text-green-400 border-green-500/30",
  legal: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  engineering: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  insurance: "bg-red-500/15 text-red-400 border-red-500/30",
  financial: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "it/technology": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  plumbing: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

export function getTradeColor(trade: string): string {
  const key = trade.toLowerCase();
  return TRADE_COLORS[key] || "bg-muted text-muted-foreground border-border";
}

export const COMMON_TRADES = [
  "Electrical",
  "Mechanical",
  "HVAC",
  "Plumbing",
  "Structural",
  "Civil",
  "Environmental",
  "Legal",
  "Engineering",
  "Insurance",
  "Financial",
  "IT/Technology",
];

export const CONTACT_STATUSES = [
  { value: "active", label: "Active", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  { value: "on-leave", label: "On Leave", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { value: "completed", label: "Completed", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  { value: "terminated", label: "Terminated", color: "bg-red-500/15 text-red-400 border-red-500/30" },
];

export function getStatusColor(status: string): string {
  const found = CONTACT_STATUSES.find((s) => s.value === status);
  return found?.color || "bg-muted text-muted-foreground border-border";
}
