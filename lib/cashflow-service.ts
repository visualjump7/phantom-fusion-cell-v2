import { supabase } from "./supabase";
import { CashFlowTransaction } from "./cashflow-parser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ───

export interface CashFlowLineItem {
  id: string;
  name: string;
  section: string;
  asset_id: string | null;
  display_order: number | null;
}

export interface CashFlowEntry {
  id: string;
  line_item_id: string;
  line_item_name?: string;
  entry_date: string;
  amount: number;
  direction: "in" | "out";
  source_file: string | null;
  notes: string | null;
}

export interface DailySummary {
  date: string;
  cashIn: number;
  cashOut: number;
  net: number;
  entries: CashFlowEntry[];
}

// ─── Line Item Management ───

async function getOrCreateLineItem(
  name: string,
  section: string
): Promise<string> {
  const { data: existing } = await db
    .from("cashflow_line_items")
    .select("id")
    .eq("name", name)
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await db
    .from("cashflow_line_items")
    .insert({ name, section })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create line item "${name}": ${error.message}`);
  return created.id;
}

// ─── Import ───

export async function importCashFlowTransactions(
  transactions: CashFlowTransaction[],
  sourceFile: string,
  userId: string
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  const lineItemCache = new Map<string, string>();

  for (const tx of transactions) {
    try {
      const cacheKey = `${tx.lineItem}|${tx.section}`;
      let lineItemId = lineItemCache.get(cacheKey);
      if (!lineItemId) {
        lineItemId = await getOrCreateLineItem(tx.lineItem, tx.section);
        lineItemCache.set(cacheKey, lineItemId);
      }

      const { error } = await db.from("cashflow_entries").insert({
        line_item_id: lineItemId,
        entry_date: tx.date,
        amount: tx.amount,
        direction: tx.direction,
        source_file: sourceFile,
        uploaded_by: userId,
      });

      if (error) {
        errors.push(`${tx.lineItem} on ${tx.date}: ${error.message}`);
      } else {
        imported++;
      }
    } catch (err) {
      errors.push(`${tx.lineItem} on ${tx.date}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { imported, errors };
}

export async function clearEntriesForDateRange(
  startDate: string,
  endDate: string
): Promise<number> {
  const { data, error } = await db
    .from("cashflow_entries")
    .delete()
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .select("id");

  if (error) throw new Error(`Failed to clear entries: ${error.message}`);
  return data?.length || 0;
}

// ─── Queries ───

export async function fetchCashFlowForMonth(
  year: number,
  month: number
): Promise<DailySummary[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await db
    .from("cashflow_entries")
    .select("*, cashflow_line_items:line_item_id(name)")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .order("entry_date", { ascending: true });

  if (error || !data) return [];

  const byDate = new Map<string, CashFlowEntry[]>();
  for (const entry of data) {
    const e: CashFlowEntry = {
      id: entry.id,
      line_item_id: entry.line_item_id,
      line_item_name: entry.cashflow_line_items?.name || "Unknown",
      entry_date: entry.entry_date,
      amount: Number(entry.amount),
      direction: entry.direction,
      source_file: entry.source_file,
      notes: entry.notes,
    };
    const existing = byDate.get(e.entry_date) || [];
    existing.push(e);
    byDate.set(e.entry_date, existing);
  }

  return Array.from(byDate.entries()).map(([date, entries]) => {
    const cashIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
    const cashOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
    return { date, cashIn, cashOut, net: cashIn - cashOut, entries };
  });
}

export async function fetchCashFlowSummary(): Promise<{
  thisMonthIn: number;
  thisMonthOut: number;
  thisMonthNet: number;
  entryCount: number;
}> {
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data } = await db
    .from("cashflow_entries")
    .select("amount, direction")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);

  const entries = data || [];
  const thisMonthIn = entries.filter((e: any) => e.direction === "in").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const thisMonthOut = entries.filter((e: any) => e.direction === "out").reduce((s: number, e: any) => s + Number(e.amount), 0);

  return { thisMonthIn, thisMonthOut, thisMonthNet: thisMonthIn - thisMonthOut, entryCount: entries.length };
}

export async function fetchAllLineItems(): Promise<CashFlowLineItem[]> {
  const { data } = await db
    .from("cashflow_line_items")
    .select("*")
    .order("section")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name");
  return data || [];
}
