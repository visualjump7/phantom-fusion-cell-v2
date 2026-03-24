"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
import {
  parseBillsExcel, validateBillFile, formatCentsToDisplay, ParseResult,
} from "@/lib/bill-parser";
import {
  importBills, fetchBillImports, fetchBillSummary, fetchBillCategories,
  updateBillStatus, Bill, BillImport, BillSummary,
} from "@/lib/bill-service";
import { supabase } from "@/lib/supabase";
import { useClientContext } from "@/lib/use-client-context";
import { ConfirmDialog } from "@/components/admin/shared/ConfirmDialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AssetOption { id: string; name: string; category: string; }

type StatusFilter = "all" | "pending" | "paid" | "overdue" | "cancelled";
type DateFilter = "all" | "this_month" | "next_30" | "overdue";

export default function WorkspaceBillsPage() {
  const { orgId, clientName } = useClientContext();

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

  const loadData = useCallback(async () => {
    const [assetData, catData, summaryData, importData] = await Promise.all([
      db.from("assets").select("id, name, category").eq("organization_id", orgId).eq("is_deleted", false).order("name"),
      fetchBillCategories(orgId),
      fetchBillSummary(orgId),
      fetchBillImports(orgId),
    ]);
    setAssets(assetData.data || []);
    setCategories(catData);
    setSummary(summaryData);
    setImports(importData);

    const { data: billData } = await db
      .from("bills")
      .select("*, assets:asset_id(name)")
      .eq("organization_id", orgId)
      .order("due_date", { ascending: true });
    setBills((billData || []).map((b: any) => ({ ...b, asset_name: b.assets?.name || null })));
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered bills
  const filteredBills = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];
    const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
    const future30 = new Date(); future30.setDate(future30.getDate() + 30);
    const next30 = future30.toISOString().split("T")[0];

    return bills.filter((b) => {
      if (statusFilter === "pending" && b.status !== "pending") return false;
      if (statusFilter === "paid" && b.status !== "paid") return false;
      if (statusFilter === "cancelled" && b.status !== "cancelled") return false;
      if (statusFilter === "overdue" && !(b.status === "pending" && b.due_date < today)) return false;
      if (assetFilter && b.asset_id !== assetFilter) return false;
      if (dateFilter === "this_month" && (b.due_date < monthStart || b.due_date > monthEnd)) return false;
      if (dateFilter === "next_30" && (b.due_date < today || b.due_date > next30)) return false;
      if (dateFilter === "overdue" && !(b.status === "pending" && b.due_date < today)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!b.title.toLowerCase().includes(q) && !(b.payee && b.payee.toLowerCase().includes(q)) && !(b.asset_name && b.asset_name.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [bills, statusFilter, assetFilter, dateFilter, searchQuery]);

  // Open add/edit modal
  const openAdd = () => {
    setEditingBill(null);
    setFormTitle(""); setFormAmount(""); setFormDueDate(""); setFormAssetId(""); setFormCategory(""); setFormPayee(""); setFormNotes(""); setFormRecurring(false); setFormError(null);
    setShowModal(true);
  };

  const openEdit = (bill: Bill) => {
    setEditingBill(bill);
    setFormTitle(bill.title); setFormAmount(String(bill.amount_cents / 100)); setFormDueDate(bill.due_date); setFormAssetId(bill.asset_id || ""); setFormCategory(bill.category || ""); setFormPayee(bill.payee || ""); setFormNotes(bill.notes || ""); setFormRecurring(bill.is_recurring); setFormError(null);
    setShowModal(true);
  };

  // Save bill
  const handleSaveBill = async () => {
    if (!formTitle.trim() || !formAmount || !formDueDate) { setFormError("Title, amount, and due date are required."); return; }
    setIsSaving(true); setFormError(null);
    try {
      const payload = {
        title: formTitle.trim(),
        amount_cents: Math.round(parseFloat(formAmount) * 100),
        due_date: formDueDate,
        asset_id: formAssetId || null,
        category: formCategory.trim() || null,
        payee: formPayee.trim() || null,
        notes: formNotes.trim() || null,
        is_recurring: formRecurring,
        updated_at: new Date().toISOString(),
      };
      if (editingBill) {
        const { error } = await db.from("bills").update(payload).eq("id", editingBill.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await db.from("bills").insert({ ...payload, organization_id: orgId, status: "pending", uploaded_by: user?.id });
        if (error) throw error;
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save bill.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete bill
  const handleDeleteBill = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await db.from("bills").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    setIsDeleting(false);
    await loadData();
  };

  // Excel upload handlers
  const handleFile = useCallback(async (file: File) => {
    setUploadError(null); setParseResult(null); setFileName(file.name);
    const validation = validateBillFile(file);
    if (!validation.valid) { setUploadError(validation.error || "Invalid file."); return; }
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseBillsExcel(buffer);
      setParseResult(result);
    } catch (err: any) {
      setUploadError(err.message || "Failed to parse file.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!parseResult) return;
    setIsSavingImport(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const result = await importBills(parseResult.bills, {
        organizationId: orgId,
        assetId: uploadAssetId || null,
        uploadedBy: user.id,
        filename: fileName || "unknown.xlsx",
      });
      setSuccessMessage(`Imported ${result.imported} bills.`);
      setShowUpload(false); setParseResult(null); setFileName(null); setUploadAssetId("");
      await loadData();
    } catch (err: any) {
      setUploadError(err.message || "Import failed.");
    } finally {
      setIsSavingImport(false);
    }
  };

  const handleStatusChange = async (billId: string, status: "pending" | "paid" | "cancelled") => {
    await updateBillStatus(billId, status);
    await loadData();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Success message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4" />{successMessage}</div>
            <button onClick={() => setSuccessMessage(null)}><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Bills</h1>
          <p className="text-sm text-muted-foreground">Manage bills for {clientName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowUpload(true)}><Upload className="mr-2 h-4 w-4" />Import</Button>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Bill</Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="border-border"><CardContent className="p-4">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Due This Month</span></div>
            <p className="mt-1 text-lg font-bold">${(summary.totalDueThisMonth / 100).toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Paid This Month</span></div>
            <p className="mt-1 text-lg font-bold">${(summary.paidThisMonth / 100).toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Next 7 Days</span></div>
            <p className="mt-1 text-lg font-bold">{summary.upcoming7DaysCount} bills</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Overdue</span></div>
            <p className="mt-1 text-lg font-bold text-red-400">{summary.overdueCount}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search bills..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <option value="all">All Dates</option>
          <option value="this_month">This Month</option>
          <option value="next_30">Next 30 Days</option>
          <option value="overdue">Overdue Only</option>
        </select>
        {assets.length > 0 && (
          <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
            <option value="">All Holdings</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {/* Bills list */}
      <div className="space-y-2">
        {filteredBills.length === 0 ? (
          <Card className="border-border"><CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No bills match your filters.</p>
          </CardContent></Card>
        ) : (
          filteredBills.map((bill) => {
            const isOverdue = bill.status === "pending" && bill.due_date < today;
            return (
              <Card key={bill.id} className={`border-border ${isOverdue ? "border-red-500/30" : ""}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{bill.title}</p>
                      <Badge variant={bill.status === "paid" ? "default" : bill.status === "cancelled" ? "secondary" : isOverdue ? "destructive" : "outline"}>
                        {isOverdue ? "Overdue" : bill.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{bill.due_date}</span>
                      {bill.asset_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{bill.asset_name}</span>}
                      {bill.payee && <span>{bill.payee}</span>}
                      {bill.category && <Badge variant="outline" className="text-xs">{bill.category}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-4">
                    <p className="text-lg font-bold text-foreground">${(bill.amount_cents / 100).toLocaleString()}</p>
                    <div className="flex items-center gap-1">
                      {bill.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(bill.id, "paid")} title="Mark paid">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(bill)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(bill)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{editingBill ? "Edit Bill" : "Add Bill"}</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {formError && <p className="mb-3 text-sm text-red-400">{formError}</p>}
              <div className="space-y-3">
                <div><label className="text-xs text-muted-foreground">Title *</label><Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Property tax payment" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Amount ($) *</label><Input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground">Due Date *</label><Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} /></div>
                </div>
                <div><label className="text-xs text-muted-foreground">Holding</label>
                  <select value={formAssetId} onChange={(e) => setFormAssetId(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                    <option value="">None</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Category</label><Input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} list="bill-categories" />
                    <datalist id="bill-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
                  <div><label className="text-xs text-muted-foreground">Payee</label><Input value={formPayee} onChange={(e) => setFormPayee(e.target.value)} /></div>
                </div>
                <div><label className="text-xs text-muted-foreground">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none" rows={2} /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formRecurring} onChange={(e) => setFormRecurring(e.target.checked)} className="rounded border-border" /> Recurring bill</label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleSaveBill} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingBill ? "Save Changes" : "Add Bill"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Excel Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setShowUpload(false); setParseResult(null); setFileName(null); }} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Import Bills from Excel</h2>
                <button onClick={() => { setShowUpload(false); setParseResult(null); setFileName(null); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {!parseResult ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  {isProcessing ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : (
                    <>
                      <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Drag & drop an Excel file, or</p>
                      <label className="mt-2 cursor-pointer rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20">
                        Browse Files
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                      </label>
                    </>
                  )}
                  {uploadError && <p className="mt-3 text-sm text-red-400">{uploadError}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4 text-primary" /><span className="font-medium">{fileName}</span><span className="text-muted-foreground">({parseResult.bills.length} bills found)</span></div>
                  <div><label className="text-xs text-muted-foreground">Assign to Holding (optional)</label>
                    <select value={uploadAssetId} onChange={(e) => setUploadAssetId(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                      <option value="">None</option>
                      {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  {parseResult.errors.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-xs font-medium text-amber-400">Warnings:</p>
                      {parseResult.errors.map((w, i) => <p key={i} className="text-xs text-amber-400/80">Row {w.row}: {w.message}</p>)}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => { setParseResult(null); setFileName(null); }}>Cancel</Button>
                    <Button onClick={handleImport} disabled={isSavingImport}>{isSavingImport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {parseResult.bills.length} Bills</Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Bill"
        description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        clientName={clientName}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteBill}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
