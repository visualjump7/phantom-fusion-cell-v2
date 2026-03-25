"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Loader2, ChevronRight, Plus, Pencil,
  Trash2, Search, X, Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getCategoryColor, cn } from "@/lib/utils";
import { useClientContext } from "@/lib/use-client-context";
import { ConfirmDialog } from "@/components/admin/shared/ConfirmDialog";
import { useRole } from "@/lib/use-role";
import { hasPermission } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Asset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
  description: string | null;
  identifier?: string | null;
}

const CATEGORY_OPTIONS = [
  { value: "family", label: "Family", color: "bg-emerald-600 text-white border-emerald-600" },
  { value: "business", label: "Business", color: "bg-blue-600 text-white border-blue-600" },
  { value: "personal", label: "Personal", color: "bg-violet-600 text-white border-violet-600" },
];

export default function WorkspaceHoldingsPage() {
  const { orgId, clientName } = useClientContext();
  const { role } = useRole();
  const canManage = hasPermission(role, "manageHoldings");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("family");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  async function loadAssets() {
    const { data } = await db
      .from("assets")
      .select("id, name, category, estimated_value, description, identifier")
      .eq("organization_id", orgId)
      .eq("is_deleted", false)
      .order("name");
    setAssets(data || []);
    setIsLoading(false);
  }

  useEffect(() => { loadAssets(); }, [orgId]);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (filter !== "all" && a.category !== filter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !(a.description && a.description.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [assets, filter, searchQuery]);

  const totalValue = filteredAssets.reduce((sum, a) => sum + (a.estimated_value || 0), 0);

  const openAdd = () => {
    setEditingAsset(null); setFormName(""); setFormCategory("family"); setFormValue(""); setFormDescription(""); setFormIdentifier(""); setFormError(null);
    setShowModal(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset); setFormName(asset.name); setFormCategory(asset.category); setFormValue(String(asset.estimated_value || "")); setFormDescription(asset.description || ""); setFormIdentifier(asset.identifier || ""); setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { setFormError("Name is required."); return; }
    setIsSaving(true); setFormError(null);
    try {
      const payload = {
        name: formName.trim(),
        category: formCategory,
        estimated_value: formValue ? parseFloat(formValue) : 0,
        description: formDescription.trim() || null,
        identifier: formIdentifier.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editingAsset) {
        const { error } = await db.from("assets").update(payload).eq("id", editingAsset.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("assets").insert({ ...payload, organization_id: orgId });
        if (error) throw error;
      }
      setShowModal(false);
      await loadAssets();
    } catch (err: any) {
      setFormError(err.message || "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await db.from("assets").update({ is_deleted: true }).eq("id", deleteTarget.id);
    setDeleteTarget(null);
    await loadAssets();
  };

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Holdings</h1>
          <p className="text-sm text-muted-foreground">{assets.length} holdings for {clientName} &middot; {formatCurrency(totalValue)} total value</p>
        </div>
        {canManage && <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Holding</Button>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search holdings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {[{ value: "all", label: "All" }, ...CATEGORY_OPTIONS].map((opt) => (
            <button key={opt.value} onClick={() => setFilter(opt.value)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", filter === opt.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset list */}
      <div className="space-y-2">
        {filteredAssets.length === 0 ? (
          <Card className="border-border"><CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No holdings match your filters.</p>
          </CardContent></Card>
        ) : (
          filteredAssets.map((asset) => (
            <Card key={asset.id} className="border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{asset.name}</p>
                    <Badge variant="outline" className={getCategoryColor(asset.category)}>{asset.category}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {asset.estimated_value > 0 && <span>{formatCurrency(asset.estimated_value)}</span>}
                    {asset.identifier && <span>{asset.identifier}</span>}
                    {asset.description && <span className="truncate max-w-[200px]">{asset.description}</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 pl-4">
                    <Link href={`/admin/client/${orgId}/upload?asset=${asset.id}`}>
                      <Button variant="ghost" size="sm" title="Upload budget"><Upload className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(asset)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(asset)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
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
                <h2 className="text-lg font-semibold">{editingAsset ? "Edit Holding" : "Add Holding"}</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {formError && <p className="mb-3 text-sm text-red-400">{formError}</p>}
              <div className="space-y-3">
                <div><label className="text-xs text-muted-foreground">Name *</label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Category</label>
                  <div className="flex gap-2 mt-1">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => setFormCategory(opt.value)}
                        className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", formCategory === opt.value ? opt.color : "border-border hover:bg-muted/30")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="text-xs text-muted-foreground">Estimated Value ($)</label><Input type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Identifier</label><Input value={formIdentifier} onChange={(e) => setFormIdentifier(e.target.value)} placeholder="e.g. tail number, hull number, address" /></div>
                <div><label className="text-xs text-muted-foreground">Description</label><textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none" /></div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingAsset ? "Save" : "Add Holding"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Holding"
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        clientName={clientName}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
