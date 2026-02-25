"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowLeft,
  Loader2, Building2, X, Plus, Pencil, Trash2, Search,
  DollarSign, Clock, AlertTriangle, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import {
  parseBillsExcel, validateBillFile, formatCentsToDisplay, ParseResult,
} from "@/lib/bill-parser";
import {
  importBills, fetchBillImports, fetchBillSummary, fetchBillCategories,
  updateBillStatus, Bill, BillImport, BillSummary,
} from "@/lib/bill-service";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface AssetOption { id: string; name: string; category: string; }

type StatusFilter = "all" | "pending" | "paid" | "overdue" | "cancelled";
type DateFilter = "all" | "this_month" | "next_30" | "overdue";

export default function AdminBillsPage() {
  const searchParams = useSearchParams();

  // Data
  const [bills, setBills] = useState<Bill[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<BillSummary | null>(null);
  const [imports, setImports] = useState<BillImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assetFilter, setAssetFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAssetId, setFormAssetId] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPayee, setFormPayee] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Excel upload
  const [showUpload, setShowUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [uploadAssetId, setUploadAssetId] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    const [assetData, catData, summaryData, importData] = await Promise.all([
      db.from("assets").select("id, name, category").eq("is_deleted", false).order("name"),
      fetchBillCategories(),
      fetchBillSummary(),
      fetchBillImports(),
    ]);
    setAssets(assetData.data || []);
    setCategories(catData);
    setSummary(summaryData);
    setImports(importData);

    const { data: billData } = await db
      .from("bills")
      .select("*, assets:asset_id(name)")
      .order("due_date", { ascending: true });
    setBills((billData || []).map((b: any) => ({ ...b, asset_name: b.assets?.name || null })));
    setIsLoading(false);

    const presetAsset = searchParams.get("asset");
    if (presetAsset && assetData.data?.some((a: AssetOption) => a.id === presetAsset)) {
      setFormAssetId(presetAsset);
      setFormDueDate(new Date().toISOString().split("T")[0]);
      setShowModal(true);
    }
  }

  useEffect(() => { loadData(); }, [searchParams]);

  const today = new Date().toISOString().split("T")[0];

  const filteredBills = useMemo(() => {
    let list = [...bills];
    if (statusFilter === "overdue") {
      list = list.filter((b) => b.status === "pending" && b.due_date < today);
    } else if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (assetFilter) list = list.filter((b) => b.asset_id === assetFilter);
    if (dateFilter === "this_month") {
      const m = today.substring(0, 7);
      list = list.filter((b) => b.due_date.startsWith(m));
    } else if (dateFilter === "next_30") {
      const f = new Date(); f.setDate(f.getDate() + 30);
      list = list.filter((b) => b.due_date >= today && b.due_date <= f.toISOString().split("T")[0]);
    } else if (dateFilter === "overdue") {
      list = list.filter((b) => b.status === "pending" && b.due_date < today);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        (b.payee && b.payee.toLowerCase().includes(q)) ||
        (b.category && b.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [bills, statusFilter, assetFilter, dateFilter, searchQuery, today]);

  const groupedAssets = assets.reduce<Record<string, AssetOption[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a); return acc;
  }, {});

  const openAddModal = () => {
    setEditingBill(null);
    setFormTitle(""); setFormAmount(""); setFormDueDate(new Date().toISOString().split("T")[0]);
    setFormAssetId(""); setFormCategory(""); setFormPayee(""); setFormNotes("");
    setFormRecurring(false); setFormError(null); setShowModal(true);
  };

  const openEditModal = (bill: Bill) => {
    setEditingBill(bill);
    setFormTitle(bill.title);
    setFormAmount((bill.amount_cents / 100).toFixed(2));
    setFormDueDate(bill.due_date);
    setFormAssetId(bill.asset_id || "");
    setFormCategory(bill.category || "");
    setFormPayee(bill.payee || "");
    setFormNotes(bill.notes || "");
    setFormRecurring(bill.is_recurring);
    setFormError(null); setShowModal(true);
  };

  const handleSaveBill = async () => {
    if (!formTitle.trim()) { setFormError("Title is required"); return; }
    if (!formAmount || parseFloat(formAmount) <= 0) { setFormError("Valid amount is required"); return; }
    if (!formDueDate) { setFormError("Due date is required"); return; }
    if (!formAssetId) { setFormError("Please select an asset"); return; }
    setIsSaving(true); setFormError(null);
    try {
      const payload = {
        title: formTitle.trim(),
        amount_cents: Math.round(parseFloat(formAmount) * 100),
        due_date: formDueDate,
        asset_id: formAssetId,
        category: formCategory.trim() || null,
        payee: formPayee.trim() || null,
        notes: formNotes.trim() || null,
        is_recurring: formRecurring,
        updated_at: new Date().toISOString(),
      };
      if (editingBill) {
        const { error } = await db.from("bills").update(payload).eq("id", editingBill.id);
        if (error) throw new Error(error.message);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await db.from("bills").insert({
          ...payload, organization_id: ORG_ID, status: "pending", uploaded_by: user?.id,
        });
        if (error) throw new Error(error.message);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally { setIsSaving(false); }
  };

  const handleMarkPaid = async (billId: string) => {
    await updateBillStatus(billId, "paid");
    await loadData();
  };

  const handleCancel = async (billId: string) => {
    await updateBillStatus(billId, "cancelled");
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await db.from("bills").delete().eq("id", deleteTarget.id);
      if (error) throw new Error(error.message);
      setDeleteTarget(null);
      await loadData();
    } catch (err) { console.error("Delete failed:", err); }
    finally { setIsDeleting(false); }
  };

  // Excel upload handlers
  const processFile = useCallback(async (file: File) => {
    setUploadError(null); setParseResult(null); setFileName(file.name); setIsProcessing(true);
    try {
      const validation = validateBillFile(file);
      if (!validation.valid) throw new Error(validation.error);
      const buffer = await file.arrayBuffer();
      const result = parseBillsExcel(buffer);
      if (result.bills.length === 0 && result.errors.length === 0) throw new Error("No data found");
      setParseResult(result);
    } catch (err) { setUploadError(err instanceof Error ? err.message : "Failed to parse"); }
    finally { setIsProcessing(false); }
  }, []);

  const handleImport = async () => {
    if (!parseResult || parseResult.bills.length === 0) return;
    setIsSavingImport(true); setUploadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const result = await importBills(parseResult.bills, {
        organizationId: ORG_ID, assetId: uploadAssetId || null,
        uploadedBy: user.id, filename: fileName || "unknown.xlsx",
      });
      setSuccessMessage(`Imported ${result.imported} bill${result.imported !== 1 ? "s" : ""}.`);
      setParseResult(null); setFileName(null); setUploadAssetId("");
      await loadData();
    } catch (err) { setUploadError(err instanceof Error ? err.message : "Import failed"); }
    finally { setIsSavingImport(false); }
  };

  const totalAmount = parseResult ? parseResult.bills.reduce((s, b) => s + b.amount_cents, 0) : 0;

  const isOverdue = (b: Bill) => b.status === "pending" && b.due_date < today;
  const isDueSoon = (b: Bill) => {
    if (b.status !== "pending") return false;
    const d = new Date(b.due_date); const t = new Date(today);
    const diff = (d.getTime() - t.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Bill Management</h1>
              <p className="text-sm text-muted-foreground">Track and manage bills across all assets</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
              <Upload className="mr-2 h-4 w-4" />{showUpload ? "Hide Upload" : "Excel Import"}
            </Button>
            <Button size="sm" onClick={openAddModal}>
              <Plus className="mr-2 h-4 w-4" />Add Bill
            </Button>
          </div>
        </div>

        {/* Success Message */}
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

        {/* ═══ DASHBOARD STATS ═══ */}
        {summary && (
          <div className="mb-8 grid gap-4 sm:grid-cols-4">
            <Card className="border-border bg-card/60"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-amber-400" /><span className="text-xs text-muted-foreground">Due This Month</span></div>
              <p className="text-xl font-bold text-foreground">{formatCentsToDisplay(summary.totalDueThisMonth)}</p>
            </CardContent></Card>
            <Card className="border-border bg-card/60"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Paid This Month</span></div>
              <p className="text-xl font-bold text-foreground">{formatCentsToDisplay(summary.paidThisMonth)}</p>
            </CardContent></Card>
            <Card className="border-border bg-card/60"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-400" /><span className="text-xs text-muted-foreground">Overdue</span></div>
              <p className="text-xl font-bold text-foreground">{formatCentsToDisplay(summary.overdueTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.overdueCount} bill{summary.overdueCount !== 1 ? "s" : ""}</p>
            </CardContent></Card>
            <Card className="border-border bg-card/60"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-blue-400" /><span className="text-xs text-muted-foreground">Next 7 Days</span></div>
              <p className="text-xl font-bold text-foreground">{formatCentsToDisplay(summary.upcoming7DaysTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.upcoming7DaysCount} bill{summary.upcoming7DaysCount !== 1 ? "s" : ""}</p>
            </CardContent></Card>
          </div>
        )}

        {/* ═══ EXCEL UPLOAD (collapsible) ═══ */}
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
              <Card className="border-border bg-card/60"><CardContent className="p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Excel Import</h3>
                {!parseResult ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Link bills to asset (optional)</label>
                      <select value={uploadAssetId} onChange={(e) => setUploadAssetId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value="">No asset — general bills</option>
                        {Object.entries(groupedAssets).map(([cat, items]) => (
                          <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                            {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
                      className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                      onClick={() => document.getElementById("bill-file-input")?.click()}
                    >
                      <input id="bill-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" />
                      {isProcessing ? (
                        <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Processing...</span></div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-foreground">Drop Excel file or click to browse</p>
                          <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
                        </div>
                      )}
                    </div>
                    {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{fileName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400"><CheckCircle className="mr-1 h-3 w-3" />{parseResult.bills.length} ready</Badge>
                          {parseResult.errors.length > 0 && <Badge variant="outline" className="border-red-500/30 text-red-400"><AlertCircle className="mr-1 h-3 w-3" />{parseResult.errors.length} errors</Badge>}
                          <span className="text-sm font-bold text-foreground">{formatCentsToDisplay(totalAmount)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setParseResult(null); setFileName(null); }}>Cancel</Button>
                        <Button size="sm" onClick={handleImport} disabled={isSavingImport}>
                          {isSavingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          Import {parseResult.bills.length} Bills
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card border-b border-border">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-muted-foreground">Date</th>
                            <th className="px-3 py-2 text-left text-xs text-muted-foreground">Title</th>
                            <th className="px-3 py-2 text-right text-xs text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseResult.bills.map((b, i) => (
                            <tr key={i} className="border-b border-border/50"><td className="px-3 py-1.5 text-foreground">{b.due_date}</td><td className="px-3 py-1.5 text-foreground">{b.title}</td><td className="px-3 py-1.5 text-right font-medium text-foreground">{formatCentsToDisplay(b.amount_cents)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent></Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ FILTERS ═══ */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "paid", "overdue", "cancelled"] as StatusFilter[]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary sm:w-48">
              <option value="">All Assets</option>
              {Object.entries(groupedAssets).map(([cat, items]) => (
                <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                  {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              ))}
            </select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary sm:w-40">
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="next_30">Next 30 Days</option>
              <option value="overdue">Overdue</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search bills..." className="pl-9 text-sm h-9" />
            </div>
          </div>
        </div>

        {/* ═══ BILL LIST ═══ */}
        {filteredBills.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">No bills found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBills.map((bill) => (
              <div key={bill.id}
                className={`group flex items-center justify-between rounded-lg border p-4 transition-colors ${
                  isOverdue(bill) ? "border-red-500/30 bg-red-500/5" :
                  isDueSoon(bill) ? "border-amber-500/20 bg-amber-500/5" :
                  bill.status === "paid" ? "border-border bg-card/30 opacity-60" :
                  bill.status === "cancelled" ? "border-border bg-card/20 opacity-40" :
                  "border-border bg-card/60"
                }`}>
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${
                    isOverdue(bill) ? "bg-red-400" : bill.status === "paid" ? "bg-emerald-400" : bill.status === "cancelled" ? "bg-muted-foreground" : isDueSoon(bill) ? "bg-amber-400" : "bg-blue-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{bill.title}</p>
                      {isOverdue(bill) && <Badge variant="outline" className="border-red-500/30 text-red-400 text-[10px] shrink-0">overdue</Badge>}
                      {bill.is_recurring && <Badge variant="outline" className="text-[10px] shrink-0">recurring</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {bill.asset_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{bill.asset_name}</span>}
                      {bill.category && <Badge variant="outline" className="text-[10px]">{bill.category}</Badge>}
                      {bill.payee && <span>· {bill.payee}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${bill.status === "paid" ? "text-muted-foreground line-through" : "text-foreground"}`}>{formatCentsToDisplay(bill.amount_cents)}</p>
                    <p className="text-xs text-muted-foreground">{bill.due_date}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {bill.status === "pending" && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300" onClick={() => handleMarkPaid(bill.id)}>
                        <CheckCircle className="mr-1 h-3 w-3" />Paid
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEditModal(bill)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {bill.status === "pending" && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-400" onClick={() => handleCancel(bill.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-400" onClick={() => setDeleteTarget(bill)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Import History */}
        {imports.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Import History</h3>
            <div className="space-y-1">
              {imports.slice(0, 5).map((imp) => (
                <div key={imp.id} className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{imp.filename}</span>
                    <span className="text-xs text-muted-foreground">{new Date(imp.created_at).toLocaleDateString()}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${imp.error_count > 0 ? "border-amber-500/30 text-amber-400" : "border-emerald-500/30 text-emerald-400"}`}>{imp.imported_count}/{imp.total_rows}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.main>

      {/* ═══ ADD/EDIT BILL MODAL ═══ */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">{editingBill ? "Edit Bill" : "Add Bill"}</h2>
                <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div><label className="mb-1 block text-sm font-medium text-foreground">Title *</label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g., HVAC Quarterly Service" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-sm font-medium text-foreground">Amount *</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="8500.00" className="pl-7" /></div></div>
                  <div><label className="mb-1 block text-sm font-medium text-foreground">Due Date *</label>
                    <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} /></div>
                </div>
                <div><label className="mb-1 block text-sm font-medium text-foreground">Asset *</label>
                  <select value={formAssetId} onChange={(e) => setFormAssetId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Select an asset...</option>
                    {Object.entries(groupedAssets).map(([cat, items]) => (
                      <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                        {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </optgroup>
                    ))}
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-sm font-medium text-foreground">Category</label>
                    <Input list="cat-list" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="e.g., Maintenance" />
                    <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
                  <div><label className="mb-1 block text-sm font-medium text-foreground">Payee</label>
                    <Input value={formPayee} onChange={(e) => setFormPayee(e.target.value)} placeholder="e.g., ComfortAir HVAC" /></div>
                </div>
                <div><label className="mb-1 block text-sm font-medium text-foreground">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Additional notes..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" /></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formRecurring} onChange={(e) => setFormRecurring(e.target.checked)} className="rounded border-border" />
                  <span className="text-sm text-foreground">This is a recurring bill</span>
                </label>
                {formError && <p className="text-sm text-red-400">{formError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={handleSaveBill} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingBill ? "Save Changes" : "Add Bill"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10"><Trash2 className="h-5 w-5 text-red-400" /></div>
                <h2 className="text-lg font-bold text-foreground">Delete Bill</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-2">This will permanently delete this bill.</p>
              <div className="rounded-lg border border-border bg-background/50 p-3 mb-4">
                <p className="text-sm font-semibold text-foreground">{deleteTarget.title}</p>
                <p className="text-sm text-muted-foreground">{formatCentsToDisplay(deleteTarget.amount_cents)} · {deleteTarget.due_date}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
