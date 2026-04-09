/**
 * Budget Editor service layer.
 *
 * Surface shipped in this push:
 *   • fetchAssetsWithBudgetStatus — drives the Budget Library page
 *   • fetchBudgetForAsset         — drives the Spreadsheet Editor
 *   • saveBudgetChanges           — persists inline cell edits
 *
 * Still to come (Phase 4+):
 *   • exportBudgetToXlsx          — Export .xlsx button
 *   • importBudgetFromXlsx        — Import .xlsx dialog
 *   • addLineItem / deleteLineItem / addCategory
 *   • audit log writes (budget_audit_log)
 */

import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Canonical asset categories used by the Budget Library grouping. */
export type AssetCategory = "business" | "family" | "personal";

export interface AssetWithBudgetStatus {
  id: string;
  name: string;
  category: string;
  estimated_value: number | null;
  /** Most recent budget year if one exists for this asset, else null. */
  latestBudgetYear: number | null;
  /** True when any budget record exists for this asset. */
  hasBudget: boolean;
}

/** Grouped output consumed by the Budget Library render. */
export interface BudgetLibraryData {
  business: AssetWithBudgetStatus[];
  family: AssetWithBudgetStatus[];
  personal: AssetWithBudgetStatus[];
  /** Assets whose category string doesn't match the three canonical buckets. */
  other: AssetWithBudgetStatus[];
}

/**
 * Fetch every asset for the given organization and annotate it with its
 * latest budget year (or null). Results are grouped by category for the
 * Budget Library page.
 *
 * RLS on assets / budgets is already org-scoped via the authenticated
 * session, so this runs with the regular anon-key client.
 */
export async function fetchAssetsWithBudgetStatus(
  organizationId: string
): Promise<BudgetLibraryData> {
  const [assetsRes, budgetsRes] = await Promise.all([
    db
      .from("assets")
      .select("id, name, category, estimated_value")
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("name", { ascending: true }),
    db
      .from("budgets")
      .select("asset_id, year")
      .eq("organization_id", organizationId)
      .order("year", { ascending: false }),
  ]);

  if (assetsRes.error) {
    throw new Error(`Failed to load assets: ${assetsRes.error.message}`);
  }
  if (budgetsRes.error) {
    throw new Error(`Failed to load budgets: ${budgetsRes.error.message}`);
  }

  // Map asset_id → most recent budget year. We ordered by year DESC so
  // the first row per asset is the latest.
  const latestYearByAsset = new Map<string, number>();
  for (const row of budgetsRes.data || []) {
    if (row.asset_id && row.year != null && !latestYearByAsset.has(row.asset_id)) {
      latestYearByAsset.set(row.asset_id, row.year);
    }
  }

  const grouped: BudgetLibraryData = {
    business: [],
    family: [],
    personal: [],
    other: [],
  };

  for (const asset of (assetsRes.data || []) as Array<{
    id: string;
    name: string;
    category: string | null;
    estimated_value: number | null;
  }>) {
    const year = latestYearByAsset.get(asset.id) ?? null;
    const entry: AssetWithBudgetStatus = {
      id: asset.id,
      name: asset.name,
      category: asset.category ?? "other",
      estimated_value: asset.estimated_value,
      latestBudgetYear: year,
      hasBudget: year != null,
    };

    const bucket = (asset.category || "").toLowerCase();
    if (bucket === "business") grouped.business.push(entry);
    else if (bucket === "family") grouped.family.push(entry);
    else if (bucket === "personal") grouped.personal.push(entry);
    else grouped.other.push(entry);
  }

  return grouped;
}

// ───────────────────────────────────────────────────────────────────────
// Spreadsheet editor — fetch + save
// ───────────────────────────────────────────────────────────────────────

/** Twelve month keys as stored on budget_line_items. */
export const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export type MonthKey = (typeof MONTHS)[number];

/** Shape returned by fetchBudgetForAsset — a single budget year's data. */
export interface BudgetLineItem {
  id: string;
  description: string;
  is_fixed: boolean;
  sort_order: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  annual_total: number;
}

export interface BudgetCategoryGroup {
  id: string; // expense_category_id
  name: string;
  color: string | null;
  items: BudgetLineItem[];
}

export interface FetchedBudget {
  budgetId: string;
  assetId: string;
  assetName: string;
  year: number;
  categories: BudgetCategoryGroup[];
}

/**
 * Load the most recent budget for an asset, plus every line item grouped
 * by expense category. Returns null when the asset has no budget yet —
 * callers should render an empty state rather than fabricating one.
 */
export async function fetchBudgetForAsset(
  assetId: string
): Promise<FetchedBudget | null> {
  // 1. Asset name (for the header).
  const assetRes = await db
    .from("assets")
    .select("id, name")
    .eq("id", assetId)
    .maybeSingle();

  if (assetRes.error) {
    throw new Error(`Failed to load asset: ${assetRes.error.message}`);
  }
  if (!assetRes.data) return null;

  // 2. Most recent budget for the asset.
  const budgetRes = await db
    .from("budgets")
    .select("id, year")
    .eq("asset_id", assetId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (budgetRes.error) {
    throw new Error(`Failed to load budget: ${budgetRes.error.message}`);
  }
  if (!budgetRes.data) return null;

  // 3. Line items + their expense category.
  // Select only columns guaranteed to exist in the base schema. The
  // Budget Editor's own extensions (is_fixed, sort_order) are optional —
  // we derive them client-side below so this query works both before and
  // after sql/018_budget_editor_schema.sql has been applied.
  const itemsRes = await db
    .from("budget_line_items")
    .select(
      `id, description,
       jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec,
       annual_total,
       expense_category_id,
       expense_categories ( id, name, color )`
    )
    .eq("budget_id", budgetRes.data.id)
    .order("description", { ascending: true });

  if (itemsRes.error) {
    throw new Error(`Failed to load line items: ${itemsRes.error.message}`);
  }

  // 4. Group by category, deriving is_fixed + sort_order client-side so
  // this works before sql/018 is applied.
  const groupsByCategoryId = new Map<string, BudgetCategoryGroup>();
  const rawRows = (itemsRes.data || []) as Array<{
    id: string;
    description: string | null;
    jan: number | null;
    feb: number | null;
    mar: number | null;
    apr: number | null;
    may: number | null;
    jun: number | null;
    jul: number | null;
    aug: number | null;
    sep: number | null;
    oct: number | null;
    nov: number | null;
    dec: number | null;
    annual_total: number | null;
    expense_category_id: string | null;
    expense_categories: {
      id: string;
      name: string | null;
      color: string | null;
    } | null;
  }>;

  rawRows.forEach((row, insertionIndex) => {
    const catId = row.expense_category_id ?? "uncategorized";
    if (!groupsByCategoryId.has(catId)) {
      groupsByCategoryId.set(catId, {
        id: catId,
        name: row.expense_categories?.name ?? "Uncategorized",
        color: row.expense_categories?.color ?? null,
        items: [],
      });
    }

    const months = [
      Number(row.jan ?? 0),
      Number(row.feb ?? 0),
      Number(row.mar ?? 0),
      Number(row.apr ?? 0),
      Number(row.may ?? 0),
      Number(row.jun ?? 0),
      Number(row.jul ?? 0),
      Number(row.aug ?? 0),
      Number(row.sep ?? 0),
      Number(row.oct ?? 0),
      Number(row.nov ?? 0),
      Number(row.dec ?? 0),
    ];

    // A line item is "Fixed" if every non-zero monthly value is the same.
    // Mirrors the heuristic used by lib/budget-parser.ts::isFixedCost.
    const nonZero = months.filter((v) => v !== 0);
    const isFixed =
      nonZero.length >= 11 &&
      nonZero.every((v) => Math.abs(v - nonZero[0]) < 0.01);

    groupsByCategoryId.get(catId)!.items.push({
      id: row.id,
      description: row.description ?? "",
      is_fixed: isFixed,
      sort_order: insertionIndex,
      jan: months[0],
      feb: months[1],
      mar: months[2],
      apr: months[3],
      may: months[4],
      jun: months[5],
      jul: months[6],
      aug: months[7],
      sep: months[8],
      oct: months[9],
      nov: months[10],
      dec: months[11],
      annual_total: Number(row.annual_total ?? 0),
    });
  });

  // Sort categories alphabetically for a stable order.
  const categories = Array.from(groupsByCategoryId.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    budgetId: budgetRes.data.id,
    assetId: assetRes.data.id,
    assetName: assetRes.data.name,
    year: budgetRes.data.year,
    categories,
  };
}

/**
 * Payload for saveBudgetChanges — a map of line item id → partial update.
 * Callers only need to include the months that changed; we recompute
 * annual_total server-side-equivalent (by summing the final twelve
 * months, so you must send either all edited months or the full row).
 */
export type BudgetCellEdit = Partial<Record<MonthKey, number>>;
export type BudgetChangeSet = Map<string, BudgetCellEdit>;

export interface SaveResult {
  success: boolean;
  savedCount: number;
  error?: string;
}

/**
 * Persist a batch of cell edits to Supabase. Each line item is updated
 * once with all its changed months, and annual_total is recomputed from
 * the *final* month values (we fetch the existing row first so untouched
 * months aren't lost).
 *
 * Uses the standard client, so RLS applies — only staff users whose
 * policies permit UPDATE on budget_line_items can save.
 */
export async function saveBudgetChanges(
  changes: BudgetChangeSet
): Promise<SaveResult> {
  if (changes.size === 0) {
    return { success: true, savedCount: 0 };
  }

  const ids = Array.from(changes.keys());

  // Fetch current rows so we can merge partial updates + recompute totals.
  const currentRes = await db
    .from("budget_line_items")
    .select(
      "id, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec"
    )
    .in("id", ids);

  if (currentRes.error) {
    return {
      success: false,
      savedCount: 0,
      error: `Failed to fetch current values: ${currentRes.error.message}`,
    };
  }

  const currentById = new Map<string, Record<MonthKey, number>>();
  for (const row of (currentRes.data || []) as Array<
    Record<MonthKey | "id", number | string>
  >) {
    const id = row.id as string;
    currentById.set(id, {
      jan: Number(row.jan ?? 0),
      feb: Number(row.feb ?? 0),
      mar: Number(row.mar ?? 0),
      apr: Number(row.apr ?? 0),
      may: Number(row.may ?? 0),
      jun: Number(row.jun ?? 0),
      jul: Number(row.jul ?? 0),
      aug: Number(row.aug ?? 0),
      sep: Number(row.sep ?? 0),
      oct: Number(row.oct ?? 0),
      nov: Number(row.nov ?? 0),
      dec: Number(row.dec ?? 0),
    });
  }

  // Build the per-row updates. We cannot batch-update with different
  // values per row in one Supabase call, so we fire them in parallel.
  const updates: Promise<{ error: { message: string } | null }>[] = [];
  for (const [id, edits] of changes.entries()) {
    const current = currentById.get(id);
    if (!current) continue;

    const merged: Record<MonthKey, number> = { ...current };
    for (const month of MONTHS) {
      if (edits[month] !== undefined) {
        const raw = edits[month];
        merged[month] = Number.isFinite(raw as number) ? Number(raw) : 0;
      }
    }

    const annual = MONTHS.reduce((sum, m) => sum + (merged[m] || 0), 0);

    updates.push(
      db
        .from("budget_line_items")
        .update({ ...merged, annual_total: annual })
        .eq("id", id)
    );
  }

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error);
  if (firstError && firstError.error) {
    return {
      success: false,
      savedCount: 0,
      error: firstError.error.message,
    };
  }

  return { success: true, savedCount: updates.length };
}
