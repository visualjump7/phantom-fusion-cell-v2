"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Building2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import {
  parseBillsExcel,
  validateBillFile,
  formatCentsToDisplay,
  ParseResult,
} from "@/lib/bill-parser";
import { importBills, fetchBillImports, BillImport } from "@/lib/bill-service";
import { supabase } from "@/lib/supabase";
// Organization ID - single principal for MVP

interface AssetOption {
  id: string;
  name: string;
  category: string;
}

export default function AdminBillsPage() {
  const router = useRouter();
  const ORG_ID = "00000000-0000-0000-0000-000000000001"; // Single principal MVP

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Asset selection
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");

  // Import history
  const [imports, setImports] = useState<BillImport[]>([]);

  // Load assets and import history
  useEffect(() => {
    async function loadData() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const { data: assetData } = await db
        .from("assets")
        .select("id, name, category")
        .eq("is_deleted", false)
        .order("name");

      if (assetData) {
        setAssets(assetData);
      }

      const importData = await fetchBillImports();
      setImports(importData);
    }
    loadData();
  }, []);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setParseResult(null);
    setSuccessMessage(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const validation = validateBillFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const buffer = await file.arrayBuffer();
      const result = parseBillsExcel(buffer);

      if (result.bills.length === 0 && result.errors.length === 0) {
        throw new Error(
          "No data found in spreadsheet. Please check the file format."
        );
      }

      setParseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleImport = async () => {
    if (!parseResult || parseResult.bills.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const result = await importBills(parseResult.bills, {
        organizationId: ORG_ID,
        assetId: selectedAssetId || null,
        uploadedBy: user.id,
        filename: fileName || "unknown.xlsx",
      });

      setSuccessMessage(
        `Successfully imported ${result.imported} bill${result.imported !== 1 ? "s" : ""}${
          result.errors.length > 0
            ? `. ${result.errors.length} error(s).`
            : "."
        }`
      );

      // Refresh imports
      const importData = await fetchBillImports();
      setImports(importData);

      // Reset form
      setParseResult(null);
      setFileName(null);
      setSelectedAssetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import bills");
    } finally {
      setIsSaving(false);
    }
  };

  const resetUpload = () => {
    setParseResult(null);
    setFileName(null);
    setError(null);
    setSuccessMessage(null);
    setSelectedAssetId("");
  };

  const totalAmount = parseResult
    ? parseResult.bills.reduce((sum, b) => sum + b.amount_cents, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Navbar />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Import Bills
              </h1>
              <p className="text-sm text-muted-foreground">
                Upload an Excel file to add bills to the fiscal calendar
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/calendar">
              <ArrowLeft className="mr-2 h-4 w-4" />
              View Calendar
            </Link>
          </Button>
        </div>

        {/* Success message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
            >
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <p className="text-sm text-emerald-300">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-auto"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area */}
        {!parseResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Asset selector */}
            <div className="mb-6 rounded-xl border border-border bg-card/60 p-4">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Link bills to an asset (optional)
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No asset — general bills</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.category})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                All imported bills will be linked to this asset
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`
                flex min-h-[200px] cursor-pointer flex-col items-center justify-center
                rounded-xl border-2 border-dashed transition-all
                ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-card/30"
                }
              `}
              onClick={() =>
                document.getElementById("bill-file-input")?.click()
              }
            >
              <input
                id="bill-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Processing {fileName}...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Drop an Excel file here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      .xlsx, .xls, or .csv — Columns: Date, Title, Amount,
                      Category, Payee, Notes
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          >
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </motion.div>
        )}

        {/* Parse Preview */}
        {parseResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="rounded-xl border border-border bg-card/60 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Preview: {fileName}
                  </h3>
                  <div className="mt-2 flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400"
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      {parseResult.bills.length} bills ready
                    </Badge>
                    {parseResult.errors.length > 0 && (
                      <Badge
                        variant="outline"
                        className="border-red-500/30 text-red-400"
                      >
                        <AlertCircle className="mr-1 h-3 w-3" />
                        {parseResult.errors.length} errors
                      </Badge>
                    )}
                    <span className="text-lg font-bold text-foreground">
                      Total: {formatCentsToDisplay(totalAmount)}
                    </span>
                  </div>
                  {selectedAssetId && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                      <Building2 className="h-3 w-3" />
                      Linked to:{" "}
                      {assets.find((a) => a.id === selectedAssetId)?.name}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetUpload}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={isSaving || parseResult.bills.length === 0}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Import {parseResult.bills.length} Bills
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Bill preview table */}
            <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Payee
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.bills.map((bill, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 hover:bg-muted/10"
                      >
                        <td className="px-4 py-2.5 text-foreground">
                          {bill.due_date}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {bill.title}
                        </td>
                        <td className="px-4 py-2.5">
                          {bill.category && (
                            <Badge variant="outline" className="text-xs">
                              {bill.category}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {bill.payee || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {formatCentsToDisplay(bill.amount_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <h4 className="mb-2 text-sm font-medium text-red-400">
                  Rows with errors (skipped):
                </h4>
                <div className="space-y-1">
                  {parseResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-300/70">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Import History */}
        {imports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Import History
            </h3>
            <div className="space-y-2">
              {imports.map((imp) => (
                <div
                  key={imp.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {imp.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(imp.created_at).toLocaleDateString()} —{" "}
                        {imp.imported_count} imported
                        {imp.error_count > 0
                          ? `, ${imp.error_count} errors`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      imp.error_count > 0
                        ? "border-amber-500/30 text-amber-400"
                        : "border-emerald-500/30 text-emerald-400"
                    }
                  >
                    {imp.imported_count}/{imp.total_rows}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.main>
    </div>
  );
}
