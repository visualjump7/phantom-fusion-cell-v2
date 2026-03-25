import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface Brief {
  id: string;
  organization_id: string;
  title: string;
  brief_date: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  blocks?: BriefBlock[];
  // Cover page fields
  cover_title?: string | null;
  cover_subtitle?: string | null;
  cover_logo_url?: string | null;
  cover_show_date?: boolean;
  cover_show_principal?: boolean;
  cover_accent_color?: string | null;
}

export interface BriefBlock {
  id: string;
  brief_id: string;
  type: "text" | "cashflow" | "bills" | "holdings" | "decisions" | "document";
  position: number;
  content_html: string | null;
  config: Record<string, any>;
  commentary: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CashFlowBlockData {
  month: string;
  year: number;
  cashIn: number;
  cashOut: number;
  net: number;
  paidCount: number;
  pendingCount: number;
}

export interface BillBlockData {
  bills: {
    id: string;
    title: string;
    amount_cents: number;
    due_date: string;
    asset_name: string | null;
    status: string;
  }[];
  total: number;
  daysAhead: number;
}

export interface HoldingsBlockData {
  holdings: {
    id: string;
    name: string;
    category: string;
    estimated_value: number;
  }[];
  totalValue: number;
  category: string | null;
}

export interface DecisionsBlockData {
  decisions: {
    id: string;
    title: string;
    priority: string;
    due_date: string | null;
    created_at: string;
  }[];
  count: number;
}

// ============================================
// Brief CRUD
// ============================================

export async function fetchBriefs(orgId: string, status?: string): Promise<Brief[]> {
  let query = db
    .from("briefs")
    .select("*, brief_blocks(id)")
    .eq("organization_id", orgId)
    .order("brief_date", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching briefs:", error);
    return [];
  }

  return (data || []).map((b: any) => ({
    ...b,
    blocks: undefined,
    _blockCount: b.brief_blocks?.length || 0,
  }));
}

export async function fetchBrief(briefId: string): Promise<Brief | null> {
  const { data, error } = await db
    .from("briefs")
    .select("*, brief_blocks(*)")
    .eq("id", briefId)
    .single();

  if (error) {
    console.error("Error fetching brief:", error);
    return null;
  }

  if (!data) return null;

  const blocks = (data.brief_blocks || []).sort(
    (a: BriefBlock, b: BriefBlock) => a.position - b.position
  );

  return { ...data, blocks, brief_blocks: undefined };
}

export async function fetchLatestPublishedBrief(orgId: string): Promise<Brief | null> {
  const { data, error } = await db
    .from("briefs")
    .select("*, brief_blocks(*)")
    .eq("organization_id", orgId)
    .eq("status", "published")
    .order("brief_date", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    console.error("Error fetching latest brief:", error);
    return null;
  }

  if (!data) return null;

  const blocks = (data.brief_blocks || []).sort(
    (a: BriefBlock, b: BriefBlock) => a.position - b.position
  );

  return { ...data, blocks, brief_blocks: undefined };
}

export async function createBrief(
  orgId: string,
  title: string,
  briefDate: string
): Promise<Brief | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await db
    .from("briefs")
    .insert({
      organization_id: orgId,
      title,
      brief_date: briefDate,
      status: "draft",
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating brief:", error);
    return null;
  }

  return data;
}

export async function updateBrief(
  briefId: string,
  updates: Partial<Pick<Brief, "title" | "brief_date" | "status" | "cover_title" | "cover_subtitle" | "cover_logo_url" | "cover_show_date" | "cover_show_principal" | "cover_accent_color">>
): Promise<boolean> {
  const { error } = await db
    .from("briefs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", briefId);

  if (error) {
    console.error("Error updating brief:", error);
    return false;
  }
  return true;
}

export async function publishBrief(briefId: string, userId: string): Promise<boolean> {
  const { error } = await db
    .from("briefs")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", briefId);

  if (error) {
    console.error("Error publishing brief:", error);
    return false;
  }
  return true;
}

export async function unpublishBrief(briefId: string): Promise<boolean> {
  const { error } = await db
    .from("briefs")
    .update({
      status: "draft",
      published_at: null,
      published_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", briefId);

  if (error) {
    console.error("Error unpublishing brief:", error);
    return false;
  }
  return true;
}

export async function deleteBrief(briefId: string): Promise<boolean> {
  const { error } = await db.from("briefs").delete().eq("id", briefId);

  if (error) {
    console.error("Error deleting brief:", error);
    return false;
  }
  return true;
}

// ============================================
// Block Operations
// ============================================

export async function addBlock(
  briefId: string,
  type: string,
  position: number,
  config?: object
): Promise<BriefBlock | null> {
  const { data, error } = await db
    .from("brief_blocks")
    .insert({
      brief_id: briefId,
      type,
      position,
      config: config || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding block:", error);
    return null;
  }
  return data;
}

export async function updateBlock(
  blockId: string,
  updates: Partial<Pick<BriefBlock, "content_html" | "config" | "commentary">>
): Promise<boolean> {
  const { error } = await db
    .from("brief_blocks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", blockId);

  if (error) {
    console.error("Error updating block:", error);
    return false;
  }
  return true;
}

export async function deleteBlock(blockId: string): Promise<boolean> {
  const { error } = await db.from("brief_blocks").delete().eq("id", blockId);

  if (error) {
    console.error("Error deleting block:", error);
    return false;
  }
  return true;
}

export async function reorderBlocks(
  briefId: string,
  blockIds: string[]
): Promise<boolean> {
  const updates = blockIds.map((id, index) =>
    db
      .from("brief_blocks")
      .update({ position: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("brief_id", briefId)
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
// Live Data Fetchers
// ============================================

export async function fetchCashFlowData(orgId: string): Promise<CashFlowBlockData> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];
  const monthName = now.toLocaleString("default", { month: "long" });

  const { data: bills } = await db
    .from("bills")
    .select("amount_cents, status")
    .eq("organization_id", orgId)
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd);

  const allBills = bills || [];
  const paid = allBills.filter((b: any) => b.status === "paid");
  const pending = allBills.filter((b: any) => b.status === "pending");

  const cashOut = paid.reduce((s: number, b: any) => s + b.amount_cents, 0);
  const pendingTotal = pending.reduce((s: number, b: any) => s + b.amount_cents, 0);

  return {
    month: monthName,
    year,
    cashIn: 0, // no income tracking yet — shows outflows only
    cashOut,
    net: -(cashOut + pendingTotal),
    paidCount: paid.length,
    pendingCount: pending.length,
  };
}

export async function fetchUpcomingBillsData(
  orgId: string,
  daysAhead: number
): Promise<BillBlockData> {
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  const endDate = future.toISOString().split("T")[0];

  const { data } = await db
    .from("bills")
    .select("id, title, amount_cents, due_date, status, assets:asset_id(name)")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .gte("due_date", today)
    .lte("due_date", endDate)
    .order("due_date", { ascending: true });

  const bills = (data || []).map((b: any) => ({
    id: b.id,
    title: b.title,
    amount_cents: b.amount_cents,
    due_date: b.due_date,
    asset_name: b.assets?.name || null,
    status: b.status,
  }));

  const total = bills.reduce((s: number, b: any) => s + b.amount_cents, 0);

  return { bills, total, daysAhead };
}

export async function fetchHoldingsSnapshot(
  orgId: string,
  category?: string
): Promise<HoldingsBlockData> {
  let query = db
    .from("assets")
    .select("id, name, category, estimated_value")
    .eq("organization_id", orgId)
    .eq("is_deleted", false)
    .order("estimated_value", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data } = await query;
  const holdings = data || [];
  const totalValue = holdings.reduce(
    (s: number, h: any) => s + (h.estimated_value || 0),
    0
  );

  return { holdings, totalValue, category: category || null };
}

export async function fetchPendingDecisions(orgId: string): Promise<DecisionsBlockData> {
  // Get decisions that have no response yet
  const { data: messages } = await db
    .from("messages")
    .select("id, title, priority, due_date, created_at")
    .eq("organization_id", orgId)
    .eq("type", "decision")
    .eq("is_deleted", false)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const allDecisions = messages || [];

  // Filter to those without responses
  const decisionIds = allDecisions.map((d: any) => d.id);
  let pendingDecisions = allDecisions;

  if (decisionIds.length > 0) {
    const { data: responses } = await db
      .from("message_responses")
      .select("message_id")
      .in("message_id", decisionIds);

    const respondedIds = new Set((responses || []).map((r: any) => r.message_id));
    pendingDecisions = allDecisions.filter((d: any) => !respondedIds.has(d.id));
  }

  return {
    decisions: pendingDecisions,
    count: pendingDecisions.length,
  };
}
