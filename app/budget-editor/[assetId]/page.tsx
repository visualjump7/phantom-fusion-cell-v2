"use client";

/**
 * Budget Editor — Spreadsheet Editor for a single asset.
 *
 * Matches the mockup at 67 budget-editor-mockup.jsx:
 *   • Sticky header with Back, asset name, year pill, Export/Import/Save
 *   • Summary bar: Annual Total, Categories, Line Items
 *   • Spreadsheet table with expand/collapse categories, F/V badges,
 *     sticky description column, sticky header row, em-dash for zero,
 *     and inline cell editing (click → input → Enter/Tab/Escape/blur)
 *   • Grand Total row at the bottom
 *   • Save button persists pending edits to Supabase in one batch
 *
 * Deferred to a later push (Phase 4/5): Export .xlsx, Import .xlsx,
 * Add/Delete line item, Add Category, toggle F/V, edit description,
 * budget_audit_log writes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight as ChevronRightIcon,
  Download,
  Loader2,
  Upload,
  Check,
} from "lucide-react";
import { useRole } from "@/lib/use-role";
import {
  fetchBudgetForAsset,
  saveBudgetChanges,
  MONTHS,
  type BudgetCategoryGroup,
  type BudgetChangeSet,
  type FetchedBudget,
  type MonthKey,
} from "@/lib/budget-editor-service";
import { exportBudgetToXlsxAndDownload } from "@/lib/budget-export";
import { ImportDialog } from "@/components/budget-editor/ImportDialog";
import type { ImportSummary } from "@/lib/budget-import";

const MONTH_LABELS: Record<MonthKey, string> = {
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function fmtCurrency(v: number): string {
  if (v === 0) return "—";
  return currencyFormatter.format(v);
}

// Local derived helpers — run off the merged view (base budget + pending changes).
interface DerivedItem {
  id: string;
  description: string;
  is_fixed: boolean;
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
  annual: number;
}

interface DerivedCategory {
  id: string;
  name: string;
  color: string | null;
  items: DerivedItem[];
  monthly: Record<MonthKey, number>;
  annual: number;
}

function buildDerivedView(
  categories: BudgetCategoryGroup[],
  changes: BudgetChangeSet
): { categories: DerivedCategory[]; grandAnnual: number; grandMonthly: Record<MonthKey, number> } {
  const derived: DerivedCategory[] = categories.map((cat) => {
    const items: DerivedItem[] = cat.items.map((item) => {
      const patch = changes.get(item.id);
      const merged: DerivedItem = {
        id: item.id,
        description: item.description,
        is_fixed: item.is_fixed,
        jan: item.jan,
        feb: item.feb,
        mar: item.mar,
        apr: item.apr,
        may: item.may,
        jun: item.jun,
        jul: item.jul,
        aug: item.aug,
        sep: item.sep,
        oct: item.oct,
        nov: item.nov,
        dec: item.dec,
        annual: 0,
      };
      if (patch) {
        for (const m of MONTHS) {
          if (patch[m] !== undefined) {
            merged[m] = patch[m] as number;
          }
        }
      }
      merged.annual = MONTHS.reduce((s, m) => s + (merged[m] || 0), 0);
      return merged;
    });

    const monthly: Record<MonthKey, number> = {
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
    };
    for (const item of items) {
      for (const m of MONTHS) monthly[m] += item[m];
    }
    const annual = items.reduce((s, it) => s + it.annual, 0);

    return {
      id: cat.id,
      name: cat.name,
      color: cat.color,
      items,
      monthly,
      annual,
    };
  });

  const grandMonthly: Record<MonthKey, number> = {
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
  };
  let grandAnnual = 0;
  for (const cat of derived) {
    for (const m of MONTHS) grandMonthly[m] += cat.monthly[m];
    grandAnnual += cat.annual;
  }

  return { categories: derived, grandAnnual, grandMonthly };
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function BudgetSpreadsheetEditorPage() {
  const router = useRouter();
  const params = useParams<{ assetId: string }>();
  const assetId = params?.assetId;
  const { role, isLoading: roleLoading, isPrincipalSide } = useRole();
  const canEdit = role === "admin" || role === "manager";

  const [budget, setBudget] = useState<FetchedBudget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pending changes map keyed on line_item_id.
  const [changes, setChanges] = useState<BudgetChangeSet>(() => new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Redirect principals.
  useEffect(() => {
    if (roleLoading) return;
    if (isPrincipalSide) router.replace("/");
  }, [roleLoading, isPrincipalSide, router]);

  // Load the budget.
  useEffect(() => {
    if (!assetId || isPrincipalSide) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    fetchBudgetForAsset(assetId)
      .then((data) => {
        if (cancelled) return;
        setBudget(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load budget");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, isPrincipalSide]);

  // Derived view (base + pending edits).
  const derived = useMemo(() => {
    if (!budget) {
      return {
        categories: [] as DerivedCategory[],
        grandAnnual: 0,
        grandMonthly: {
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
        } as Record<MonthKey, number>,
      };
    }
    return buildDerivedView(budget.categories, changes);
  }, [budget, changes]);

  const totalLineItems = useMemo(
    () => derived.categories.reduce((s, c) => s + c.items.length, 0),
    [derived]
  );

  const hasChanges = changes.size > 0;

  const toggleCategory = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const commitCellEdit = useCallback(
    (itemId: string, month: MonthKey, raw: string) => {
      const parsed = parseFloat(raw.replace(/[, $]/g, ""));
      const value = Number.isFinite(parsed) ? parsed : 0;
      setChanges((prev) => {
        const next = new Map(prev);
        const existing = next.get(itemId) || {};
        next.set(itemId, { ...existing, [month]: value });
        return next;
      });
      setSaveState("idle");
    },
    []
  );

  const handleExport = useCallback(() => {
    if (!budget) return;
    try {
      exportBudgetToXlsxAndDownload(budget);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Export failed");
      setSaveState("error");
    }
  }, [budget]);

  const handleImportConfirm = useCallback(
    async (summary: ImportSummary) => {
      if (!budget || summary.changes.size === 0) return;
      setSaveState("saving");
      setSaveError(null);
      const result = await saveBudgetChanges(summary.changes);
      if (!result.success) {
        setSaveState("error");
        setSaveError(result.error || "Import failed");
        throw new Error(result.error || "Import failed");
      }
      // Fold the imported edits into the base budget so further manual
      // edits start from the new values.
      setBudget((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) => {
              const patch = summary.changes.get(item.id);
              if (!patch) return item;
              const merged = { ...item };
              for (const m of MONTHS) {
                if (patch[m] !== undefined) {
                  (merged as unknown as Record<MonthKey, number>)[m] = patch[
                    m
                  ] as number;
                }
              }
              merged.annual_total = MONTHS.reduce(
                (s, m) =>
                  s +
                  ((merged as unknown as Record<MonthKey, number>)[m] || 0),
                0
              );
              return merged;
            }),
          })),
        };
      });
      // Clear any pending manual edits that were overwritten by the import.
      setChanges((prev) => {
        const next = new Map(prev);
        for (const id of summary.changes.keys()) next.delete(id);
        return next;
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
    },
    [budget]
  );

  const handleSave = useCallback(async () => {
    if (!hasChanges || saveState === "saving") return;
    setSaveState("saving");
    setSaveError(null);
    const result = await saveBudgetChanges(changes);
    if (result.success) {
      // Fold the pending edits into the base budget so further edits
      // start from the saved state.
      setBudget((prev) => {
        if (!prev) return prev;
        const next: FetchedBudget = {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) => {
              const patch = changes.get(item.id);
              if (!patch) return item;
              const merged = { ...item };
              for (const m of MONTHS) {
                if (patch[m] !== undefined) {
                  (merged as unknown as Record<MonthKey, number>)[m] = patch[m] as number;
                }
              }
              merged.annual_total = MONTHS.reduce(
                (s, m) => s + ((merged as unknown as Record<MonthKey, number>)[m] || 0),
                0
              );
              return merged;
            }),
          })),
        };
        return next;
      });
      setChanges(new Map());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
    } else {
      setSaveState("error");
      setSaveError(result.error || "Save failed");
    }
  }, [changes, hasChanges, saveState]);

  // ─── Loading / auth states ─────────────────────────────────────────────

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (isPrincipalSide) {
    return null;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-black">
        <EditorHeader
          assetName="Error"
          year={null}
          backHref="/budget-editor"
          hasChanges={false}
          saveState="idle"
          onSave={() => {}}
          canEdit={false}
        />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
            {loadError}
          </div>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-black">
        <EditorHeader
          assetName="No budget"
          year={null}
          backHref="/budget-editor"
          hasChanges={false}
          saveState="idle"
          onSave={() => {}}
          canEdit={false}
        />
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <p className="text-sm text-white/70 mb-4">
            This project doesn&apos;t have a budget yet.
          </p>
          <Link
            href={`/upload?asset=${assetId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/10 px-4 py-2 text-xs font-medium text-[#4ade80] hover:bg-[#4ade80]/15 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Import a budget spreadsheet
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black text-white">
      <EditorHeader
        assetName={budget.assetName}
        year={budget.year}
        backHref="/budget-editor"
        hasChanges={hasChanges}
        saveState={saveState}
        onSave={handleSave}
        onExport={handleExport}
        onImport={() => setImportOpen(true)}
        canEdit={canEdit}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        currentBudget={budget}
        onConfirm={handleImportConfirm}
      />

      {/* Summary bar */}
      <div className="flex gap-8 border-b border-[#161616] px-6 py-4">
        <SummaryStat label="Annual Total" value={fmtCurrency(derived.grandAnnual)} accent />
        <SummaryStat label="Categories" value={String(derived.categories.length)} />
        <SummaryStat label="Line Items" value={String(totalLineItems)} />
      </div>

      {/* Save error banner */}
      {saveState === "error" && saveError && (
        <div className="mx-6 mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          Save failed: {saveError}
        </div>
      )}

      {/* Spreadsheet */}
      <div className="overflow-x-auto pb-12">
        <table className="w-full min-w-[1400px] border-collapse text-[13px]">
          <thead>
            <tr className="sticky top-[57px] z-40 bg-[#0a0a0a]">
              <th className="sticky left-0 z-[41] w-[280px] border-b border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-white/50">
                Description
              </th>
              <th className="w-[50px] border-b border-[#1a1a1a] px-1.5 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-white/50">
                Type
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  className="min-w-[85px] border-b border-[#1a1a1a] px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-white/50"
                >
                  {MONTH_LABELS[m]}
                </th>
              ))}
              <th className="min-w-[100px] border-b border-[#1a1a1a] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#4ade80]">
                Annual
              </th>
            </tr>
          </thead>
          <tbody>
            {derived.categories.map((cat) => {
              const isCollapsed = collapsed.has(cat.id);
              return (
                <CategoryBlock
                  key={cat.id}
                  category={cat}
                  collapsed={isCollapsed}
                  onToggle={() => toggleCategory(cat.id)}
                  canEdit={canEdit}
                  onCommitEdit={commitCellEdit}
                />
              );
            })}

            {/* Grand total row */}
            <tr className="border-t-2 border-[#222222]">
              <td className="sticky left-0 z-10 bg-black px-4 py-3 text-[14px] font-bold">
                TOTAL
              </td>
              <td />
              {MONTHS.map((m) => (
                <td
                  key={m}
                  className="px-3 py-3 text-right text-[13px] font-semibold text-white"
                >
                  {fmtCurrency(derived.grandMonthly[m])}
                </td>
              ))}
              <td className="px-4 py-3 text-right text-[15px] font-bold text-[#4ade80]">
                {fmtCurrency(derived.grandAnnual)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function EditorHeader({
  assetName,
  year,
  backHref,
  hasChanges,
  saveState,
  onSave,
  onExport,
  onImport,
  canEdit,
}: {
  assetName: string;
  year: number | null;
  backHref: string;
  hasChanges: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onSave: () => void;
  onExport?: () => void;
  onImport?: () => void;
  canEdit: boolean;
}) {
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : "Save Changes";

  const saveDisabled = !canEdit || !hasChanges || saveState === "saving";

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-[#222222] bg-black/95 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Library
        </Link>
        <span className="text-white/20">|</span>
        <span className="text-[15px] font-semibold text-white">
          {assetName}
        </span>
        {year !== null && (
          <span className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-0.5 text-[12px] text-white/70">
            {year}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport}
          className="flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-transparent px-4 py-1.5 text-[13px] text-white/70 transition-colors hover:border-[#4ade80] hover:text-white disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:border-[#2a2a2a]"
        >
          <Download className="h-3.5 w-3.5" />
          Export .xlsx
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={!onImport || !canEdit}
          title={!canEdit ? "Read-only access" : undefined}
          className="flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-transparent px-4 py-1.5 text-[13px] text-white/70 transition-colors hover:border-[#4ade80] hover:text-white disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:border-[#2a2a2a]"
        >
          <Upload className="h-3.5 w-3.5" />
          Import .xlsx
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className={[
            "flex items-center gap-1.5 rounded-lg px-5 py-1.5 text-[13px] font-semibold transition-all",
            saveState === "saved"
              ? "bg-[#166534] text-[#4ade80]"
              : hasChanges && canEdit
                ? "bg-[#4ade80] text-black hover:brightness-110"
                : "border border-[#2a2a2a] bg-transparent text-white/30 cursor-not-allowed",
          ].join(" ")}
        >
          {saveState === "saving" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {saveState === "saved" && <Check className="h-3.5 w-3.5" />}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] uppercase tracking-wider text-white/50">
        {label}
      </div>
      <div
        className={
          accent
            ? "text-[22px] font-bold text-[#4ade80]"
            : "text-[22px] font-bold text-white"
        }
      >
        {value}
      </div>
    </div>
  );
}

function CategoryBlock({
  category,
  collapsed,
  onToggle,
  canEdit,
  onCommitEdit,
}: {
  category: DerivedCategory;
  collapsed: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onCommitEdit: (itemId: string, month: MonthKey, raw: string) => void;
}) {
  return (
    <>
      {/* Category header row */}
      <tr
        className="cursor-pointer bg-[#0d0d0d] hover:bg-[#111111]"
        onClick={onToggle}
      >
        <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <ChevronRightIcon
              className={`h-3 w-3 text-[#4ade80] transition-transform ${
                !collapsed ? "rotate-90" : ""
              }`}
            />
            <span>{category.name}</span>
            <span className="text-[11px] font-normal text-white/50">
              ({category.items.length})
            </span>
          </div>
        </td>
        <td className="px-1.5 py-2.5" />
        {MONTHS.map((m) => (
          <td
            key={m}
            className="px-3 py-2.5 text-right text-[12px] font-medium text-white/50"
          >
            {fmtCurrency(category.monthly[m])}
          </td>
        ))}
        <td className="px-4 py-2.5 text-right text-[13px] font-semibold text-[#4ade80]">
          {fmtCurrency(category.annual)}
        </td>
      </tr>

      {/* Line items */}
      {!collapsed &&
        category.items.map((item) => (
          <LineItemRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            onCommitEdit={onCommitEdit}
          />
        ))}
    </>
  );
}

function LineItemRow({
  item,
  canEdit,
  onCommitEdit,
}: {
  item: DerivedItem;
  canEdit: boolean;
  onCommitEdit: (itemId: string, month: MonthKey, raw: string) => void;
}) {
  return (
    <tr className="border-b border-[#111111] hover:bg-[#080808]">
      <td className="sticky left-0 z-10 max-w-[280px] truncate whitespace-nowrap bg-black py-2 pl-10 pr-4 text-[13px] text-white/70">
        {item.description}
      </td>
      <td className="px-1.5 py-2 text-center">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            item.is_fixed
              ? "bg-[#4ade80]/10 text-[#4ade80]"
              : "bg-[#facc15]/10 text-[#facc15]"
          }`}
        >
          {item.is_fixed ? "F" : "V"}
        </span>
      </td>
      {MONTHS.map((m) => (
        <EditableCell
          key={m}
          value={item[m]}
          canEdit={canEdit}
          onCommit={(raw) => onCommitEdit(item.id, m, raw)}
        />
      ))}
      <td className="px-4 py-2 text-right text-[13px] font-semibold text-white/80">
        {fmtCurrency(item.annual)}
      </td>
    </tr>
  );
}

function EditableCell({
  value,
  canEdit,
  onCommit,
}: {
  value: number;
  canEdit: boolean;
  onCommit: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(value === 0 ? "" : String(value));
    setEditing(true);
  };

  const commit = () => {
    onCommit(draft);
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  return (
    <td
      onClick={startEdit}
      className={`px-3 py-2 text-right ${canEdit ? "cursor-text hover:bg-[#111111]" : ""} ${
        value === 0 ? "text-[#333333]" : "text-[#d4d4d8]"
      }`}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="w-[75px] rounded border border-[#4ade80] bg-[#1a1a1a] px-2 py-0.5 text-right text-[13px] text-white outline-none"
        />
      ) : (
        <span className="text-[13px]">{fmtCurrency(value)}</span>
      )}
    </td>
  );
}
