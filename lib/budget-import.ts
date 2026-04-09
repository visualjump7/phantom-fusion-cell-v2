/**
 * Budget Editor — import from .xlsx
 *
 * Reuses lib/budget-parser.ts to parse the uploaded workbook, then matches
 * parsed rows against the current budget's line items by description
 * (case-insensitive, trimmed, collapsed whitespace). Outputs a preview the
 * user can review before committing.
 *
 * What this does NOT do (yet):
 *   • Insert new line items (Excel rows that don't match any existing item
 *     are surfaced in the preview but not inserted).
 *   • Delete items that exist in Supabase but not in the Excel file (shown
 *     as warnings only — the spec is explicit about not auto-deleting).
 */

import {
  getSheetList,
  parseBudgetSheet,
  type SheetInfo,
  type ParsedLineItem,
} from "./budget-parser";
import {
  MONTHS,
  type BudgetChangeSet,
  type BudgetLineItem,
  type FetchedBudget,
  type MonthKey,
} from "./budget-editor-service";

export interface ImportSummary {
  /** Sheet selected for import. */
  sheetName: string;
  /** Pending changes keyed by line_item_id — feed this to saveBudgetChanges(). */
  changes: BudgetChangeSet;
  /** Number of line items that will actually be updated. */
  updatedCount: number;
  /** Excel rows that could not be matched to an existing item (shown to user). */
  unmatchedExcelItems: ParsedLineItem[];
  /** Existing items that don't appear in the import (shown to user, not deleted). */
  missingFromImport: BudgetLineItem[];
  /** Non-fatal parser warnings. */
  errors: { row: number; message: string }[];
}

/** Normalize a description for lookup: lowercase, trim, collapse whitespace. */
function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Read the uploaded file into an ArrayBuffer. Thin wrapper that exists so
 * callers can stub it in tests.
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("Unexpected FileReader result"));
    };
    reader.onerror = () => reject(reader.error || new Error("Read failed"));
    reader.readAsArrayBuffer(file);
  });
}

/** List sheets in the uploaded workbook (for the sheet selector). */
export async function listSheetsInFile(file: File): Promise<SheetInfo[]> {
  const buffer = await readFileAsArrayBuffer(file);
  return getSheetList(buffer);
}

/**
 * Parse the chosen sheet and diff against the current budget to build a
 * preview. Does NOT write to Supabase — the caller shows the summary to
 * the user, then calls saveBudgetChanges(summary.changes) on confirm.
 */
export async function buildImportSummary(
  file: File,
  sheetName: string,
  currentBudget: FetchedBudget
): Promise<ImportSummary> {
  const buffer = await readFileAsArrayBuffer(file);
  const parsed = parseBudgetSheet(buffer, sheetName);

  // Flatten the current budget into a description → item lookup map.
  const byDescription = new Map<string, BudgetLineItem>();
  for (const cat of currentBudget.categories) {
    for (const item of cat.items) {
      byDescription.set(normalize(item.description), item);
    }
  }

  const changes: BudgetChangeSet = new Map();
  const unmatchedExcelItems: ParsedLineItem[] = [];
  const matchedIds = new Set<string>();

  for (const parsedItem of parsed.lineItems) {
    const key = normalize(parsedItem.name);
    const existing = byDescription.get(key);
    if (!existing) {
      unmatchedExcelItems.push(parsedItem);
      continue;
    }

    // Check if any month value actually differs before queuing an update.
    const monthEdits: Partial<Record<MonthKey, number>> = {};
    let anyDiff = false;
    for (const m of MONTHS) {
      const newVal = Number(parsedItem[m] || 0);
      const oldVal = Number(existing[m] || 0);
      if (Math.abs(newVal - oldVal) > 0.005) {
        monthEdits[m] = newVal;
        anyDiff = true;
      }
    }

    if (anyDiff) {
      changes.set(existing.id, monthEdits);
    }
    matchedIds.add(existing.id);
  }

  const missingFromImport: BudgetLineItem[] = [];
  for (const cat of currentBudget.categories) {
    for (const item of cat.items) {
      if (!matchedIds.has(item.id)) {
        missingFromImport.push(item);
      }
    }
  }

  return {
    sheetName,
    changes,
    updatedCount: changes.size,
    unmatchedExcelItems,
    missingFromImport,
    errors: parsed.errors,
  };
}
