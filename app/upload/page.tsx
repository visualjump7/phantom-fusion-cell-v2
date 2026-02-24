"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, CheckCircle, Loader2, FileSpreadsheet, AlertCircle,
  ArrowLeft, ArrowRight, Download, X, Building2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  parseBudgetFile, validateBudgetFile, generateBudgetTemplate,
  BudgetParseResult, ParsedBudgetLine,
} from "@/lib/budget-parser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const CATEGORY_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#06B6D4", "#84CC16",
];

type WizardStep = "select" | "upload" | "preview" | "importing" | "done";

interface Asset {
  id: string;
  name: string;
  category: string;
}

export default function UploadPage() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<WizardStep>("select");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<BudgetParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [existingBudgetId, setExistingBudgetId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAssets() {
      const { data } = await db
        .from("assets")
        .select("id, name, category")
        .eq("is_deleted", false)
        .order("name");
      setAssets(data || []);

      const presetAsset = searchParams.get("asset");
      const presetYear = searchParams.get("year");
      if (presetAsset && data?.some((a: Asset) => a.id === presetAsset)) {
        setSelectedAssetId(presetAsset);
        if (presetYear) setSelectedYear(Number(presetYear));
        setStep("upload");
      }
    }
    loadAssets();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedAssetId || !selectedYear) {
      setExistingBudgetId(null);
      return;
    }
    async function checkExisting() {
      const { data } = await db
        .from("budgets")
        .select("id")
        .eq("asset_id", selectedAssetId)
        .eq("year", selectedYear)
        .limit(1);
      setExistingBudgetId(data && data.length > 0 ? data[0].id : null);
    }
    checkExisting();
  }, [selectedAssetId, selectedYear]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const groupedAssets = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {});

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setParseResult(null);
    setFileName(file.name);
    setIsProcessing(true);
    try {
      const validation = validateBudgetFile(file);
      if (!validation.valid) throw new Error(validation.error);
      const buffer = await file.arrayBuffer();
      const result = parseBudgetFile(buffer);
      if (result.lines.length === 0 && result.errors.length === 0) {
        throw new Error("No data found. Check the file format — expected columns: Category, Description, Jan–Dec.");
      }
      setParseResult(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDownloadTemplate = () => {
    const buffer = generateBudgetTemplate();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "budget_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.lines.length === 0 || !selectedAssetId) return;
    setStep("importing");
    setImportProgress(0);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let budgetId = existingBudgetId;

      if (budgetId && replaceExisting) {
        await db.from("budget_line_items").delete().eq("budget_id", budgetId);
      }

      if (!budgetId) {
        const { data: newBudget, error: budgetErr } = await db
          .from("budgets")
          .insert({ asset_id: selectedAssetId, organization_id: ORG_ID, year: selectedYear, created_by: user.id })
          .select("id")
          .single();
        if (budgetErr) throw new Error(`Failed to create budget: ${budgetErr.message}`);
        budgetId = newBudget.id;
      }

      const categories = [...new Set(parseResult.lines.map((l) => l.category))];
      const categoryMap = new Map<string, string>();

      for (const catName of categories) {
        const { data: existing } = await db
          .from("expense_categories")
          .select("id")
          .eq("name", catName)
          .limit(1);

        if (existing && existing.length > 0) {
          categoryMap.set(catName, existing[0].id);
        } else {
          const color = CATEGORY_COLORS[categoryMap.size % CATEGORY_COLORS.length];
          const { data: created, error: catErr } = await db
            .from("expense_categories")
            .insert({ name: catName, color })
            .select("id")
            .single();
          if (catErr) throw new Error(`Failed to create category "${catName}": ${catErr.message}`);
          categoryMap.set(catName, created.id);
        }
      }

      const batchSize = 20;
      let imported = 0;
      for (let i = 0; i < parseResult.lines.length; i += batchSize) {
        const batch = parseResult.lines.slice(i, i + batchSize).map((line) => ({
          budget_id: budgetId,
          expense_category_id: categoryMap.get(line.category),
          description: line.description,
          jan: line.jan, feb: line.feb, mar: line.mar, apr: line.apr,
          may: line.may, jun: line.jun, jul: line.jul, aug: line.aug,
          sep: line.sep, oct: line.oct, nov: line.nov, dec: line.dec,
          annual_total: line.annual_total,
        }));

        const { error: insertErr } = await db.from("budget_line_items").insert(batch);
        if (insertErr) throw new Error(`Failed to insert line items: ${insertErr.message}`);

        imported += batch.length;
        setImportProgress(Math.round((imported / parseResult.lines.length) * 100));
      }

      setImportedCount(imported);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const resetWizard = () => {
    setStep("select");
    setSelectedAssetId("");
    setSelectedYear(new Date().getFullYear());
    setParseResult(null);
    setFileName(null);
    setError(null);
    setImportProgress(0);
    setImportedCount(0);
    setExistingBudgetId(null);
  };

  const steps: { key: WizardStep; label: string }[] = [
    { key: "select", label: "Select Asset" },
    { key: "upload", label: "Upload File" },
    { key: "preview", label: "Preview" },
    { key: "importing", label: "Import" },
    { key: "done", label: "Done" },
  ];

  const stepOrder: WizardStep[] = ["select", "upload", "preview", "importing", "done"];
  const currentIndex = stepOrder.indexOf(step);

  const annualTotal = parseResult
    ? parseResult.lines.reduce((s, l) => s + l.annual_total, 0)
    : 0;

  const categoryTotals = parseResult
    ? parseResult.lines.reduce<Record<string, number>>((acc, l) => {
        acc[l.category] = (acc[l.category] || 0) + l.annual_total;
        return acc;
      }, {})
    : {};

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Budget Upload</h1>
            <p className="text-sm text-muted-foreground">Upload Excel budget spreadsheets for your assets</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((s, i) => {
            const isCompleted = stepOrder.indexOf(s.key) < currentIndex;
            const isCurrent = s.key === step;
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-6 ${isCompleted ? "bg-primary" : "bg-border"}`} />}
                <div className="flex items-center gap-1.5">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isCompleted ? "bg-primary text-primary-foreground" :
                    isCurrent ? "bg-primary/20 text-primary border border-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4 text-muted-foreground" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ STEP 1: SELECT ASSET ═══ */}
        {step === "select" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="border-border bg-card/60">
              <CardContent className="p-6 space-y-4">
                <label className="block text-sm font-medium text-foreground">Select an asset</label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Choose an asset...</option>
                  {Object.entries(groupedAssets).map(([category, items]) => (
                    <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                      {items.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <label className="block text-sm font-medium text-foreground">Budget year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {existingBudgetId && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <span className="text-sm text-amber-300">A budget already exists for this asset and year. Importing will replace existing line items.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep("upload")}
                disabled={!selectedAssetId}
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 2: UPLOAD FILE ═══ */}
        {step === "upload" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {selectedAsset && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{selectedAsset.name}</span> &middot; {selectedYear}
                </span>
                <Badge variant="outline" className="ml-2 capitalize text-xs">{selectedAsset.category}</Badge>
              </div>
            )}

            {existingBudgetId && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-300">Existing budget will be replaced on import.</span>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-card/30"
              }`}
              onClick={() => document.getElementById("budget-file-input")?.click()}
            >
              <input id="budget-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processing {fileName}...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Drop an Excel file here or click to browse</p>
                    <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls, or .csv — Columns: Category, Description, Jan–Dec, Annual Total</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 3: PREVIEW ═══ */}
        {step === "preview" && parseResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Summary */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Preview: {fileName}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                        <CheckCircle className="mr-1 h-3 w-3" />{parseResult.lines.length} line items
                      </Badge>
                      {parseResult.errors.length > 0 && (
                        <Badge variant="outline" className="border-red-500/30 text-red-400">
                          <AlertCircle className="mr-1 h-3 w-3" />{parseResult.errors.length} errors
                        </Badge>
                      )}
                      <span className="text-lg font-bold text-foreground">Total: {formatCurrency(annualTotal)}</span>
                    </div>
                    {selectedAsset && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                        <Building2 className="h-3 w-3" />{selectedAsset.name} &middot; {selectedYear}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setParseResult(null); setFileName(null); setStep("upload"); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleImport} disabled={parseResult.lines.length === 0}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Import {parseResult.lines.length} Items
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category summary */}
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(categoryTotals).map(([cat, total]) => (
                <div key={cat} className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="text-xs text-muted-foreground">{cat}</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(total)}</p>
                </div>
              ))}
            </div>

            {/* Line items table */}
            <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Monthly Avg</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Annual Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.lines.map((line, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-xs">{line.category}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{line.description}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {formatCurrency(line.annual_total / 12)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {formatCurrency(line.annual_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parse errors */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <h4 className="mb-2 text-sm font-medium text-red-400">Rows with errors (skipped):</h4>
                <div className="space-y-1">
                  {parseResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-300/70">Row {err.row}: {err.message}</p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ STEP 4: IMPORTING ═══ */}
        {step === "importing" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <p className="text-lg font-semibold text-foreground mb-2">Importing budget data...</p>
            <p className="text-sm text-muted-foreground mb-6">{selectedAsset?.name} &middot; {selectedYear}</p>
            <div className="w-64 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{importProgress}%</p>
          </motion.div>
        )}

        {/* ═══ STEP 5: DONE ═══ */}
        {step === "done" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-6">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Import Complete!</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Successfully imported {importedCount} line items
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {selectedAsset?.name} &middot; {selectedYear} Budget
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetWizard}>
                Upload Another
              </Button>
              {selectedAssetId && (
                <Button asChild>
                  <Link href={`/assets/${selectedAssetId}`}>
                    View Asset <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </motion.main>
    </div>
  );
}
