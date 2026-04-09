"use client";

/**
 * Budget Editor — Import .xlsx modal.
 *
 * Flow:
 *   1. File picker (click to browse or drop). .xlsx / .xls / .csv accepted.
 *   2. If the workbook has >1 sheet, a sheet selector appears.
 *   3. Preview counts: will update X / N matched, unmatched Y, missing Z.
 *   4. Confirm → commit the change set via the callback (parent calls
 *      saveBudgetChanges).
 *   5. Cancel / close resets state.
 *
 * Uses the existing xlsx (SheetJS) dependency — no new installs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Upload, FileSpreadsheet, Loader2, AlertTriangle, Check } from "lucide-react";
import {
  buildImportSummary,
  listSheetsInFile,
  type ImportSummary,
} from "@/lib/budget-import";
import type { FetchedBudget } from "@/lib/budget-editor-service";
import type { SheetInfo } from "@/lib/budget-parser";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  currentBudget: FetchedBudget;
  /** Called with the built summary after the user confirms the import. */
  onConfirm: (summary: ImportSummary) => Promise<void> | void;
}

type Stage = "pick" | "sheet" | "preview" | "submitting" | "done" | "error";

export function ImportDialog({
  open,
  onClose,
  currentBudget,
  onConfirm,
}: ImportDialogProps) {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when dialog closes.
  useEffect(() => {
    if (!open) {
      setStage("pick");
      setFile(null);
      setSheets([]);
      setSelectedSheet(null);
      setSummary(null);
      setError(null);
      setIsDragging(false);
    }
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleFile = useCallback(
    async (f: File) => {
      setError(null);
      setFile(f);
      try {
        const sheetList = await listSheetsInFile(f);
        if (sheetList.length === 0) {
          setError("The workbook has no sheets.");
          setStage("error");
          return;
        }
        setSheets(sheetList);
        if (sheetList.length === 1) {
          // Skip the selector and jump straight to preview.
          setSelectedSheet(sheetList[0].name);
          const s = await buildImportSummary(f, sheetList[0].name, currentBudget);
          setSummary(s);
          setStage("preview");
        } else {
          setStage("sheet");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read file");
        setStage("error");
      }
    },
    [currentBudget]
  );

  const handleSheetChoice = useCallback(
    async (name: string) => {
      if (!file) return;
      setError(null);
      setSelectedSheet(name);
      try {
        const s = await buildImportSummary(file, name, currentBudget);
        setSummary(s);
        setStage("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse sheet");
        setStage("error");
      }
    },
    [file, currentBudget]
  );

  const handleConfirm = useCallback(async () => {
    if (!summary) return;
    setStage("submitting");
    try {
      await onConfirm(summary);
      setStage("done");
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStage("error");
    }
  }, [summary, onConfirm, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(560px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-2xl border border-[#222222] bg-[#0a0a0a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-[#4ade80]" />
            <h2 className="text-[14px] font-semibold text-white">
              Import Budget Spreadsheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Stage: pick ─── */}
          {stage === "pick" && (
            <>
              <p className="mb-4 text-[12px] text-white/60">
                Upload an .xlsx file matching the Fusion Cell template. Rows
                are matched to existing line items by description.
              </p>
              <label
                htmlFor="budget-import-file"
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-[#4ade80] bg-[#4ade80]/5"
                    : "border-[#2a2a2a] bg-[#111111] hover:border-[#4ade80]/60"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFile(f);
                }}
              >
                <FileSpreadsheet className="h-7 w-7 text-white/30" />
                <p className="text-[13px] font-medium text-white">
                  Drop a file here, or click to browse
                </p>
                <p className="text-[11px] text-white/40">
                  .xlsx or .xls · up to 10 MB
                </p>
                <input
                  ref={fileInputRef}
                  id="budget-import-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </label>
            </>
          )}

          {/* Stage: sheet ─── */}
          {stage === "sheet" && (
            <>
              <p className="mb-4 text-[12px] text-white/60">
                This workbook contains multiple sheets. Choose the one to
                import.
              </p>
              <ul className="space-y-1.5">
                {sheets.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onClick={() => handleSheetChoice(s.name)}
                      className="flex w-full items-center justify-between rounded-lg border border-[#222222] bg-[#111111] px-3 py-2.5 text-left text-[13px] text-white hover:border-[#4ade80] transition-colors"
                    >
                      <span className="font-medium">{s.name}</span>
                      {s.year && (
                        <span className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-0.5 text-[10px] text-white/60">
                          {s.year}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Stage: preview ─── */}
          {stage === "preview" && summary && (
            <>
              <p className="mb-4 text-[12px] text-white/60">
                Review changes before applying. Sheet:{" "}
                <span className="text-white">{summary.sheetName}</span>
              </p>
              <div className="space-y-2">
                <PreviewStat
                  icon={<Check className="h-3.5 w-3.5 text-[#4ade80]" />}
                  label={`${summary.updatedCount} line item${
                    summary.updatedCount === 1 ? "" : "s"
                  } will be updated`}
                  tone="ok"
                />
                {summary.unmatchedExcelItems.length > 0 && (
                  <PreviewStat
                    icon={<AlertTriangle className="h-3.5 w-3.5 text-[#facc15]" />}
                    label={`${summary.unmatchedExcelItems.length} row${
                      summary.unmatchedExcelItems.length === 1 ? "" : "s"
                    } in your file won't be imported (no match by description)`}
                    tone="warn"
                    details={summary.unmatchedExcelItems.slice(0, 5).map((i) => i.name)}
                    moreCount={Math.max(0, summary.unmatchedExcelItems.length - 5)}
                  />
                )}
                {summary.missingFromImport.length > 0 && (
                  <PreviewStat
                    icon={<AlertTriangle className="h-3.5 w-3.5 text-[#facc15]" />}
                    label={`${summary.missingFromImport.length} existing line item${
                      summary.missingFromImport.length === 1 ? "" : "s"
                    } aren't in your file (kept as-is — nothing will be deleted)`}
                    tone="warn"
                    details={summary.missingFromImport.slice(0, 5).map((i) => i.description)}
                    moreCount={Math.max(0, summary.missingFromImport.length - 5)}
                  />
                )}
                {summary.errors.length > 0 && (
                  <PreviewStat
                    icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                    label={`${summary.errors.length} parser warning${
                      summary.errors.length === 1 ? "" : "s"
                    }`}
                    tone="warn"
                    details={summary.errors.slice(0, 5).map((e) => e.message)}
                    moreCount={Math.max(0, summary.errors.length - 5)}
                  />
                )}
              </div>

              {summary.updatedCount === 0 && (
                <p className="mt-4 text-[11px] text-white/40">
                  Nothing to import — no rows matched an existing line item
                  with different values.
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStage("pick")}
                  className="rounded-lg border border-[#2a2a2a] bg-transparent px-4 py-1.5 text-[12px] text-white/60 hover:text-white hover:border-white/30 transition-colors"
                >
                  Choose a different file
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={summary.updatedCount === 0}
                  className={`rounded-lg px-5 py-1.5 text-[12px] font-semibold transition-all ${
                    summary.updatedCount === 0
                      ? "border border-[#2a2a2a] bg-transparent text-white/30 cursor-not-allowed"
                      : "bg-[#4ade80] text-black hover:brightness-110"
                  }`}
                >
                  Apply {summary.updatedCount} update
                  {summary.updatedCount === 1 ? "" : "s"}
                </button>
              </div>
            </>
          )}

          {/* Stage: submitting ─── */}
          {stage === "submitting" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#4ade80]" />
              <p className="text-[13px] text-white/70">Applying updates…</p>
            </div>
          )}

          {/* Stage: done ─── */}
          {stage === "done" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Check className="h-6 w-6 text-[#4ade80]" />
              <p className="text-[13px] text-white">Import complete</p>
            </div>
          )}

          {/* Stage: error ─── */}
          {stage === "error" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-[12px] text-red-300">
              {error || "Something went wrong"}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setStage("pick")}
                  className="rounded-lg border border-[#2a2a2a] bg-transparent px-3 py-1 text-[11px] text-white/60 hover:text-white hover:border-white/30 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  icon,
  label,
  tone,
  details,
  moreCount,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "ok" | "warn";
  details?: string[];
  moreCount?: number;
}) {
  const borderClass =
    tone === "ok" ? "border-[#4ade80]/30 bg-[#4ade80]/5" : "border-[#facc15]/30 bg-[#facc15]/5";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${borderClass}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/90">{label}</p>
          {details && details.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {details.map((d, i) => (
                <li key={i} className="truncate text-[11px] text-white/50">
                  · {d}
                </li>
              ))}
              {moreCount !== undefined && moreCount > 0 && (
                <li className="text-[11px] text-white/40">
                  · …and {moreCount} more
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
