"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Loader2, CheckCircle, AlertCircle, X, ArrowUpCircle,
  ArrowDownCircle, DollarSign, Calendar, FileSpreadsheet, AlertTriangle,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  parseCashFlowFile, validateCashFlowFile, parseFilenameDate,
  CashFlowParseResult,
} from "@/lib/cashflow-parser";
import {
  importCashFlowTransactions, clearEntriesForDateRange,
} from "@/lib/cashflow-service";

export default function AdminCashFlowPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CashFlowParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const formatCurrency = (val: number) =>
    `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const processFile = useCallback(async (file: File) => {
    setError(null); setParseResult(null); setSuccessMessage(null);
    setFileName(file.name); setIsProcessing(true);
    try {
      const validation = validateCashFlowFile(file);
      if (!validation.valid) throw new Error(validation.error);
      const buffer = await file.arrayBuffer();
      const result = parseCashFlowFile(buffer);
      if (result.transactions.length === 0 && result.warnings.length === 0) {
        throw new Error("No transaction data found. Check the file format.");
      }
      setParseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally { setIsProcessing(false); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processFile(file);
  }, [processFile]);

  const handleImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) return;
    setIsImporting(true); setError(null); setImportProgress(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (replaceExisting && parseResult.dateRange) {
        await clearEntriesForDateRange(parseResult.dateRange.start, parseResult.dateRange.end);
      }

      const batchSize = 50;
      let totalImported = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < parseResult.transactions.length; i += batchSize) {
        const batch = parseResult.transactions.slice(i, i + batchSize);
        const result = await importCashFlowTransactions(batch, fileName || "unknown.xlsx", user.id);
        totalImported += result.imported;
        allErrors.push(...result.errors);
        setImportProgress(Math.round(((i + batch.length) / parseResult.transactions.length) * 100));
      }

      setSuccessMessage(
        `Imported ${totalImported} transactions${allErrors.length > 0 ? ` with ${allErrors.length} errors` : ""}.`
      );
      setParseResult(null); setFileName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally { setIsImporting(false); }
  };

  const resetUpload = () => {
    setParseResult(null); setFileName(null); setError(null); setSuccessMessage(null);
  };

  const cashInItems = parseResult?.lineItems.filter((li) => li.section !== "cash_out") || [];
  const cashOutItems = parseResult?.lineItems.filter((li) => li.section === "cash_out") || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cash Flow Upload</h1>
            <p className="text-sm text-muted-foreground">Import daily cash flow data from Excel</p>
          </div>
        </div>

        {/* Success */}
        <AnimatePresence>
          {successMessage && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <p className="text-sm text-emerald-300">{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)} className="ml-auto"><X className="h-4 w-4 text-muted-foreground" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4 text-muted-foreground" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ UPLOAD AREA ═══ */}
        {!parseResult && !isImporting && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-card/30"
              }`}
              onClick={() => document.getElementById("cashflow-file-input")?.click()}
            >
              <input id="cashflow-file-input" type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Parsing {fileName}...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Drop a Cash Flow Excel file here or click to browse</p>
                    <p className="mt-1 text-xs text-muted-foreground">.xlsx format — Daily columns with Cash In / Cash Out sections</p>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-foreground">Replace existing entries for overlapping dates</span>
            </label>
          </motion.div>
        )}

        {/* ═══ IMPORTING ═══ */}
        {isImporting && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <p className="text-lg font-semibold text-foreground mb-2">Importing cash flow data...</p>
            <div className="w-64 h-2 rounded-full bg-muted overflow-hidden mt-4">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{importProgress}%</p>
          </motion.div>
        )}

        {/* ═══ PREVIEW ═══ */}
        {parseResult && !isImporting && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Summary stats */}
            <div className="grid gap-4 sm:grid-cols-4">
              <Card className="border-border bg-card/60"><CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Total Cash In</span></div>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(parseResult.summary.totalCashIn)}</p>
              </CardContent></Card>
              <Card className="border-border bg-card/60"><CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 text-red-400" /><span className="text-xs text-muted-foreground">Total Cash Out</span></div>
                <p className="text-xl font-bold text-red-400">{formatCurrency(parseResult.summary.totalCashOut)}</p>
              </CardContent></Card>
              <Card className="border-border bg-card/60"><CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-blue-400" /><span className="text-xs text-muted-foreground">Net Cash Flow</span></div>
                <p className={`text-xl font-bold ${parseResult.summary.netCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {parseResult.summary.netCashFlow >= 0 ? "+" : "-"}{formatCurrency(parseResult.summary.netCashFlow)}
                </p>
              </CardContent></Card>
              <Card className="border-border bg-card/60"><CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><Calendar className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Date Range</span></div>
                <p className="text-sm font-bold text-foreground">{parseResult.summary.transactionCount} entries</p>
                <p className="text-[10px] text-muted-foreground">{parseResult.summary.dateCount} days</p>
              </CardContent></Card>
            </div>

            {/* File info + actions */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">{fileName}</h3>
                    </div>
                    {parseResult.dateRange && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {parseResult.dateRange.start} → {parseResult.dateRange.end}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetUpload}>Cancel</Button>
                    <Button size="sm" onClick={handleImport}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Import {parseResult.summary.transactionCount} Entries
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line items breakdown */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border bg-card/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowUpCircle className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-foreground">Cash In ({cashInItems.length} items)</h4>
                  </div>
                  <div className="space-y-1.5">
                    {cashInItems.map((li) => (
                      <div key={li.name} className="flex items-center justify-between">
                        <span className="text-xs text-foreground truncate">{li.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{li.count}</Badge>
                      </div>
                    ))}
                    {cashInItems.length === 0 && <p className="text-xs text-muted-foreground italic">No cash-in items</p>}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowDownCircle className="h-4 w-4 text-red-400" />
                    <h4 className="text-sm font-semibold text-foreground">Cash Out ({cashOutItems.length} items)</h4>
                  </div>
                  <div className="space-y-1.5">
                    {cashOutItems.map((li) => (
                      <div key={li.name} className="flex items-center justify-between">
                        <span className="text-xs text-foreground truncate">{li.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{li.count}</Badge>
                      </div>
                    ))}
                    {cashOutItems.length === 0 && <p className="text-xs text-muted-foreground italic">No cash-out items</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-semibold text-amber-400">
                      {parseResult.warnings.length} Annotation{parseResult.warnings.length !== 1 ? "s" : ""} Found
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Text values were found in numeric cells. These are skipped during import.</p>
                  <div className="max-h-[150px] overflow-y-auto space-y-1">
                    {parseResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-300/70">
                        Row {w.row}, {w.lineItem} on {w.date}: &ldquo;{w.value}&rdquo;
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transaction preview */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Recent Transactions Preview</h4>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2 text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-2 text-muted-foreground">Line Item</th>
                        <th className="text-center py-2 px-2 text-muted-foreground">Direction</th>
                        <th className="text-right py-2 px-2 text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.transactions.slice(0, 100).map((tx, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                          <td className="py-1.5 px-2 text-foreground">{tx.date}</td>
                          <td className="py-1.5 px-2 text-foreground">{tx.lineItem}</td>
                          <td className="py-1.5 px-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${tx.direction === "in" ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
                              {tx.direction}
                            </Badge>
                          </td>
                          <td className={`py-1.5 px-2 text-right font-medium tabular-nums ${tx.direction === "in" ? "text-emerald-400" : "text-red-400"}`}>
                            {tx.direction === "in" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.transactions.length > 100 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      Showing first 100 of {parseResult.transactions.length} transactions
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.main>
    </div>
  );
}
