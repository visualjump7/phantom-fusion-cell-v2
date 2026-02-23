import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface Bill {
  id: string;
  organization_id: string;
  asset_id: string | null;
  asset_name: string | null;
  title: string;
  amount_cents: number;
  due_date: string;
  category: string | null;
  payee: string | null;
  notes: string | null;
  status: "pending" | "paid" | "cancelled";
  is_recurring: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BillSummary {
  totalDueThisMonth: number;
  paidThisMonth: number;
  upcomingCount: number;
  upcoming7DaysTotal: number;
  upcoming7DaysCount: number;
  overdueCount: number;
  overdueTotal: number;
}

export interface BillImport {
  id: string;
  filename: string;
  total_rows: number;
  imported_count: number;
  error_count: number;
  errors: { row: number; message: string }[];
  asset_id: string | null;
  uploaded_by: string;
  created_at: string;
}

// ============================================
// Query Functions
// ============================================

/**
 * Fetch bills for a date range (calendar view)
 */
export async function fetchBillsForRange(
  startDate: string,
  endDate: string,
  status?: string
): Promise<Bill[]> {
  let query = db
    .from("bills")
    .select(
      `
      *,
      assets:asset_id (name)
    `
    )
    .gte("due_date", startDate)
    .lte("due_date", endDate)
    .order("due_date", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching bills:", error);
    return [];
  }

  return (data || []).map((bill: any) => ({
    ...bill,
    asset_name: bill.assets?.name || null,
  }));
}

/**
 * Fetch bills for a specific month (calendar primary view)
 */
export async function fetchBillsForMonth(
  year: number,
  month: number
): Promise<Bill[]> {
  // Extend range to cover partial weeks on edges
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Pad for calendar display
  const startPad = new Date(firstDay);
  startPad.setDate(startPad.getDate() - firstDay.getDay());

  const endPad = new Date(lastDay);
  endPad.setDate(endPad.getDate() + (6 - lastDay.getDay()));

  const startDate = startPad.toISOString().split("T")[0];
  const endDate = endPad.toISOString().split("T")[0];

  return fetchBillsForRange(startDate, endDate);
}

/**
 * Fetch bills for a specific asset
 */
export async function fetchBillsForAsset(assetId: string): Promise<Bill[]> {
  const { data, error } = await db
    .from("bills")
    .select("*")
    .eq("asset_id", assetId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Error fetching asset bills:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch upcoming bills (next N days)
 */
export async function fetchUpcomingBills(days: number = 7): Promise<Bill[]> {
  const today = new Date().toISOString().split("T")[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const endDate = futureDate.toISOString().split("T")[0];

  return fetchBillsForRange(today, endDate, "pending");
}

/**
 * Get bill summary stats for dashboard
 */
export async function fetchBillSummary(): Promise<BillSummary> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const future7 = new Date();
  future7.setDate(future7.getDate() + 7);
  const next7 = future7.toISOString().split("T")[0];

  // All bills this month
  const { data: monthBills } = await db
    .from("bills")
    .select("amount_cents, status")
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd);

  // Upcoming 7 days (pending only)
  const { data: upcoming7 } = await db
    .from("bills")
    .select("amount_cents")
    .gte("due_date", today)
    .lte("due_date", next7)
    .eq("status", "pending");

  // Overdue bills
  const { data: overdue } = await db
    .from("bills")
    .select("amount_cents")
    .lt("due_date", today)
    .eq("status", "pending");

  const allMonth = monthBills || [];
  const pending = allMonth.filter(
    (b: { status: string }) => b.status === "pending"
  );
  const paid = allMonth.filter((b: { status: string }) => b.status === "paid");

  return {
    totalDueThisMonth: pending.reduce(
      (sum: number, b: { amount_cents: number }) => sum + b.amount_cents,
      0
    ),
    paidThisMonth: paid.reduce(
      (sum: number, b: { amount_cents: number }) => sum + b.amount_cents,
      0
    ),
    upcomingCount: pending.length,
    upcoming7DaysTotal: (upcoming7 || []).reduce(
      (sum: number, b: { amount_cents: number }) => sum + b.amount_cents,
      0
    ),
    upcoming7DaysCount: (upcoming7 || []).length,
    overdueCount: (overdue || []).length,
    overdueTotal: (overdue || []).reduce(
      (sum: number, b: { amount_cents: number }) => sum + b.amount_cents,
      0
    ),
  };
}

/**
 * Get all unique bill categories
 */
export async function fetchBillCategories(): Promise<string[]> {
  const { data, error } = await db
    .from("bills")
    .select("category")
    .not("category", "is", null)
    .order("category");

  if (error) return [];

  const unique = [...new Set((data || []).map((b: { category: string }) => b.category))];
  return unique as string[];
}

/**
 * Update bill status
 */
export async function updateBillStatus(
  billId: string,
  status: "pending" | "paid" | "cancelled"
): Promise<boolean> {
  const { error } = await db
    .from("bills")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", billId);

  if (error) {
    console.error("Error updating bill status:", error);
    return false;
  }
  return true;
}

/**
 * Import bills from parsed Excel data
 */
export async function importBills(
  bills: {
    title: string;
    amount_cents: number;
    due_date: string;
    category: string | null;
    payee: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
  }[],
  options: {
    organizationId: string;
    assetId?: string | null;
    uploadedBy: string;
    filename: string;
  }
): Promise<{
  imported: number;
  errors: { row: number; message: string }[];
  importId: string;
}> {
  const errors: { row: number; message: string }[] = [];
  let imported = 0;

  // Create import record
  const { data: importRecord, error: importError } = await db
    .from("bill_imports")
    .insert({
      organization_id: options.organizationId,
      filename: options.filename,
      total_rows: bills.length,
      asset_id: options.assetId || null,
      uploaded_by: options.uploadedBy,
    })
    .select("id")
    .single();

  if (importError) {
    console.error("Error creating import record:", importError);
    return { imported: 0, errors: [{ row: 0, message: "Failed to create import record" }], importId: "" };
  }

  // Insert bills in batches of 50
  const batchSize = 50;
  for (let i = 0; i < bills.length; i += batchSize) {
    const batch = bills.slice(i, i + batchSize).map((bill) => ({
      organization_id: options.organizationId,
      asset_id: options.assetId || null,
      title: bill.title,
      amount_cents: bill.amount_cents,
      due_date: bill.due_date,
      category: bill.category,
      payee: bill.payee,
      notes: bill.notes,
      metadata: bill.metadata,
      status: "pending",
      uploaded_by: options.uploadedBy,
    }));

    const { error: batchError } = await db.from("bills").insert(batch);

    if (batchError) {
      console.error("Batch insert error:", batchError);
      errors.push({
        row: i + 1,
        message: `Failed to insert batch starting at row ${i + 1}: ${batchError.message}`,
      });
    } else {
      imported += batch.length;
    }
  }

  // Update import record with results
  await db
    .from("bill_imports")
    .update({
      imported_count: imported,
      error_count: errors.length,
      errors: errors,
    })
    .eq("id", importRecord.id);

  return { imported, errors, importId: importRecord.id };
}

/**
 * Fetch import history
 */
export async function fetchBillImports(): Promise<BillImport[]> {
  const { data, error } = await db
    .from("bill_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching imports:", error);
    return [];
  }

  return data || [];
}

/**
 * Get data snapshot for AI assistant context
 */
export async function fetchBillsSnapshot(): Promise<{
  totalDue: number;
  billCount: number;
  upcoming7Days: { title: string; amount_cents: number; due_date: string; asset_name: string | null }[];
  categories: { category: string; total: number; count: number }[];
}> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const future7 = new Date();
  future7.setDate(future7.getDate() + 7);
  const next7 = future7.toISOString().split("T")[0];

  // Month totals
  const { data: monthPending } = await db
    .from("bills")
    .select("amount_cents")
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd)
    .eq("status", "pending");

  // Upcoming 7 days with asset names
  const { data: upcoming } = await db
    .from("bills")
    .select("title, amount_cents, due_date, assets:asset_id(name)")
    .gte("due_date", today)
    .lte("due_date", next7)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(10);

  // Category breakdown
  const { data: allPending } = await db
    .from("bills")
    .select("category, amount_cents")
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd)
    .eq("status", "pending");

  const categoryMap = new Map<string, { total: number; count: number }>();
  (allPending || []).forEach((b: { category: string | null; amount_cents: number }) => {
    const cat = b.category || "Uncategorized";
    const existing = categoryMap.get(cat) || { total: 0, count: 0 };
    categoryMap.set(cat, {
      total: existing.total + b.amount_cents,
      count: existing.count + 1,
    });
  });

  return {
    totalDue: (monthPending || []).reduce((s: number, b: { amount_cents: number }) => s + b.amount_cents, 0),
    billCount: (monthPending || []).length,
    upcoming7Days: (upcoming || []).map((b: any) => ({
      title: b.title,
      amount_cents: b.amount_cents,
      due_date: b.due_date,
      asset_name: b.assets?.name || null,
    })),
    categories: Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data,
    })),
  };
}
