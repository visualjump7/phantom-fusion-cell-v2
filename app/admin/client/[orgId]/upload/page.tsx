"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, CheckCircle, Loader2, FileSpreadsheet, AlertCircle,
  ArrowLeft, ArrowRight, Download, X, Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  getSheetList, parseBudgetSheet, validateBudgetFile, generateBudgetTemplate,
  ParseResult, SheetInfo,
} from "@/lib/budget-parser";
import { useClientContext } from "@/lib/use-client-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const CATEGORY_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#06B6D4", "#84CC16",
];

type WizardStep = "select" | "upload" | "sheet" | "preview" | "importing" | "done";

interface Asset {
  id: string;
  name: string;
  category: string;
}

export default function WorkspaceUploadPage() {
  const { orgId, clientName } = useClientContext();

  const [step, setStep] = useState<WizardStep>("select");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ categories: number; lineItems: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingBudget, setExistingBudget] = useState<{ id: string; created_at: string } | null>(null);

  useEffect(() => {
    db.from("assets").select("id, name, category").eq("organization_id", orgId).eq("is_deleted", false).order("name")
      .then(({ data }: any) => setAssets(data || []));
  }, [orgId]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const checkExistingBudget = async () => {
    if (!selectedAssetId) return;
    const { data } = await db
      .from("budgets")
      .select("id, created_at")
      .eq("asset_id", selectedAssetId)
      .eq("organization_id", orgId)
      .eq("year", selectedYear)
      .single();
    setExistingBudget(data || null);
  };

  useEffect(() => {
    if (selectedAssetId) checkExistingBudget();
  }, [selectedAssetId, selectedYear]);

  const handleFileUpload = useCallback(async (file: File) => {
    setError(null);
    const validation = validateBudgetFile(file);
    if (!validation.valid) { setError(validation.error || "Invalid file."); return; }
    setFileName(file.name); setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      setFileBuffer(buffer);
      const sheetList = getSheetList(buffer);
      setSheets(sheetList);
      if (sheetList.length === 1) {
        setSelectedSheet(sheetList[0].name);
        const result = parseBudgetSheet(buffer, sheetList[0].name);
        setParseResult(result);
        setStep("preview");
      } else {
        setStep("sheet");
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse file.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSheetSelect = (sheetName: string) => {
    if (!fileBuffer) return;
    setSelectedSheet(sheetName);
    try {
      const result = parseBudgetSheet(fileBuffer, sheetName);
      setParseResult(result);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse sheet.");
    }
  };

  const handleImport = async () => {
    if (!parseResult || !selectedAssetId) return;
    setStep("importing"); setImportProgress(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete existing budget if present
      if (existingBudget) {
        await db.from("budget_line_items").delete().eq("budget_id", existingBudget.id);
        await db.from("budgets").delete().eq("id", existingBudget.id);
      }
      setImportProgress(20);

      // Create budget
      const { data: budget, error: budgetError } = await db
        .from("budgets")
        .insert({ asset_id: selectedAssetId, organization_id: orgId, year: selectedYear, created_by: user.id })
        .select("id").single();
      if (budgetError) throw budgetError;
      setImportProgress(40);

      // Create categories
      const categoryMap = new Map<string, string>();
      for (const catName of parseResult.categories) {
        const { data: existing } = await db.from("expense_categories").select("id").eq("name", catName).limit(1);
        if (existing && existing.length > 0) {
          categoryMap.set(catName, existing[0].id);
        } else {
          const color = CATEGORY_COLORS[categoryMap.size % CATEGORY_COLORS.length];
          const { data: created } = await db.from("expense_categories").insert({ name: catName, color }).select("id").single();
          if (created) categoryMap.set(catName, created.id);
        }
      }
      setImportProgress(60);

      // Create line items
      const batchSize = 20;
      let imported = 0;
      for (let i = 0; i < parseResult.lineItems.length; i += batchSize) {
        const batch = parseResult.lineItems.slice(i, i + batchSize).map((item) => ({
          budget_id: budget.id,
          expense_category_id: categoryMap.get(item.category) || null,
          description: item.name,
          jan: item.jan, feb: item.feb, mar: item.mar, apr: item.apr,
          may: item.may, jun: item.jun, jul: item.jul, aug: item.aug,
          sep: item.sep, oct: item.oct, nov: item.nov, dec: item.dec,
          annual_total: item.annual_total,
        }));
        await db.from("budget_line_items").insert(batch);
        imported += batch.length;
        setImportProgress(60 + Math.round((imported / parseResult.lineItems.length) * 40));
      }

      setImportProgress(100);
      setImportResult({ categories: parseResult.categories.length, lineItems: parseResult.lineItems.length });
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Import failed.");
      setStep("preview");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const resetWizard = () => {
    setStep("select"); setFileName(null); setFileBuffer(null); setSheets([]);
    setSelectedSheet(""); setParseResult(null); setImportResult(null); setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Budget Upload</h1>
        <p className="text-sm text-muted-foreground">Import budget data for {clientName}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Select Project", "Upload File", "Preview", "Done"].map((label, i) => {
          const stepMap = ["select", "upload", "preview", "done"];
          const stepIndex = stepMap.indexOf(step);
          const isActive = i <= stepIndex || (step === "sheet" && i <= 1) || (step === "importing" && i <= 2);
          return (
            <span key={label} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-border" />}
              <span className={`rounded-full px-2 py-0.5 ${isActive ? "bg-primary/10 text-primary font-medium" : ""}`}>{label}</span>
            </span>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Select step */}
      {step === "select" && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <div><label className="text-sm font-medium text-foreground">Project *</label>
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="">Select a project...</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.category})</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium text-foreground">Budget Year</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {existingBudget && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
              A budget already exists for {selectedAsset?.name} ({selectedYear}). Importing will replace it.
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => {
              const buffer = generateBudgetTemplate();
              const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "budget_template.xlsx"; a.click();
              URL.revokeObjectURL(url);
            }}><Download className="mr-2 h-4 w-4" />Download Template</Button>
            <Button disabled={!selectedAssetId} onClick={() => setStep("upload")}><ArrowRight className="mr-2 h-4 w-4" />Next</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Upload step */}
      {step === "upload" && (
        <Card className="border-border"><CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-primary" /><span className="font-medium">{selectedAsset?.name}</span>
            <Badge variant="outline">{selectedYear}</Badge>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}>
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <>
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Drag & drop a budget spreadsheet, or</p>
                <label className="mt-2 cursor-pointer rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20">
                  Browse Files
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                </label>
              </>
            )}
          </div>
          <div className="mt-4 flex justify-start">
            <Button variant="outline" onClick={() => setStep("select")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Sheet selection step */}
      {step === "sheet" && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Multiple sheets found in <span className="font-medium text-foreground">{fileName}</span>. Select the budget sheet:</p>
          <div className="space-y-2">
            {sheets.map((s) => (
              <button key={s.name} onClick={() => handleSheetSelect(s.name)}
                className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/30 transition-colors">
                <span className="font-medium">{s.name}</span>
                {s.year && <span className="text-muted-foreground ml-2">({s.year})</span>}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setStep("upload")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        </CardContent></Card>
      )}

      {/* Preview step */}
      {step === "preview" && parseResult && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <span className="font-medium">{fileName}</span>
            {selectedSheet && <Badge variant="outline">{selectedSheet}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Found {parseResult.categories.length} categories with {parseResult.lineItems.length} line items.
          </p>
          {parseResult.errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              {parseResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-400">Row {e.row}: {e.message}</p>)}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto space-y-3">
            {parseResult.categories.map((catName, ci) => {
              const items = parseResult.lineItems.filter((l) => l.category === catName);
              return (
                <div key={ci}>
                  <p className="text-sm font-medium text-foreground">{catName} ({items.length} items)</p>
                  <div className="ml-4 space-y-0.5">
                    {items.slice(0, 3).map((item, ii) => (
                      <p key={ii} className="text-xs text-muted-foreground">{item.name} — ${item.annual_total.toLocaleString()}/yr</p>
                    ))}
                    {items.length > 3 && <p className="text-xs text-muted-foreground">...and {items.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={handleImport}><Upload className="mr-2 h-4 w-4" />Import Budget</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Importing step */}
      {step === "importing" && (
        <Card className="border-border"><CardContent className="flex flex-col items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium text-foreground">Importing budget...</p>
          <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${importProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{importProgress}%</p>
        </CardContent></Card>
      )}

      {/* Done step */}
      {step === "done" && importResult && (
        <Card className="border-border"><CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500" />
          <p className="mt-4 text-lg font-semibold text-foreground">Budget Imported</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {importResult.categories} categories, {importResult.lineItems} line items imported for {selectedAsset?.name} ({selectedYear}).
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={resetWizard}>Import Another</Button>
            <Link href={`/admin/client/${orgId}/projects`}><Button>View Projects</Button></Link>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
