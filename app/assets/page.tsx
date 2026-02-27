"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Loader2, ChevronRight, Upload, Plus, Pencil,
  Trash2, MoreHorizontal, Search, X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getCategoryColor, cn } from "@/lib/utils";
import { useRole } from "@/lib/use-role";

interface Asset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
  description: string | null;
  identifier?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const CATEGORY_OPTIONS = [
  { value: "family", label: "Family", color: "bg-emerald-600 text-white border-emerald-600" },
  { value: "business", label: "Business", color: "bg-blue-600 text-white border-blue-600" },
  { value: "personal", label: "Personal", color: "bg-violet-600 text-white border-violet-600" },
];

export default function AssetsPage() {
  const { isAdmin } = useRole();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("family");
  const [formValue, setFormValue] = useState("");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function loadAssets() {
    const { data } = await db
      .from("assets")
      .select("id, name, category, estimated_value, description, identifier")
      .eq("is_deleted", false)
      .order("estimated_value", { ascending: false });
    setAssets(data || []);
    setIsLoading(false);
  }

  useEffect(() => { loadAssets(); }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenuId]);

  const categories = ["all", ...new Set(assets.map((a) => a.category))];

  const filtered = useMemo(() => {
    let list = filter === "all" ? assets : assets.filter((a) => a.category === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.identifier && a.identifier.toLowerCase().includes(q))
      );
    }
    return list;
  }, [assets, filter, searchQuery]);

  const categoryColors: Record<string, string> = {
    family: "bg-emerald-600 text-white border-emerald-600",
    business: "bg-blue-600 text-white border-blue-600",
    personal: "bg-violet-600 text-white border-violet-600",
  };

  const strokeClasses: Record<string, string> = {
    family: "asset-card-stroke asset-card-stroke-emerald",
    business: "asset-card-stroke asset-card-stroke-blue",
    personal: "asset-card-stroke asset-card-stroke-violet",
  };
  const getStrokeClass = (category: string) => strokeClasses[category] ?? "asset-card-stroke-default";

  const openAddModal = () => {
    setEditingAsset(null);
    setFormName("");
    setFormCategory("family");
    setFormValue("");
    setFormIdentifier("");
    setFormDescription("");
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setFormName(asset.name);
    setFormCategory(asset.category);
    setFormValue(String(asset.estimated_value || ""));
    setFormIdentifier(asset.identifier || "");
    setFormDescription(asset.description || "");
    setFormError(null);
    setShowModal(true);
    setOpenMenuId(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) { setFormError("Asset name is required"); return; }
    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: formName.trim(),
        category: formCategory,
        estimated_value: parseFloat(formValue) || 0,
        identifier: formIdentifier.trim() || null,
        description: formDescription.trim() || null,
        organization_id: ORG_ID,
      };

      if (editingAsset) {
        const { organization_id, ...updatePayload } = payload;
        const { error } = await db.from("assets").update(updatePayload).eq("id", editingAsset.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from("assets").insert(payload);
        if (error) throw new Error(error.message);
      }

      setShowModal(false);
      await loadAssets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("assets").update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
      }).eq("id", deleteTarget.id);
      if (error) throw new Error(error.message);
      setDeleteTarget(null);
      await loadAssets();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

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
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Assets</h1>
              <p className="text-sm text-muted-foreground">Your complete portfolio</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openAddModal}>
              <Plus className="mr-2 h-4 w-4" /> Add Asset
            </Button>
          )}
        </div>

        {/* Search + Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  filter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="pl-9 text-sm h-9"
            />
          </div>
        </div>

        {/* Asset Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">{searchQuery ? "No assets match your search" : "No assets found"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((asset, i) => (
              <motion.div key={asset.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="relative group">
                  <Link href={`/assets/${asset.id}`}>
                    <Card className={cn(getStrokeClass(asset.category), "bg-card/60 backdrop-blur-sm transition-all hover:bg-card/80")}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <Badge variant="outline" className={`text-xs capitalize ${categoryColors[asset.category] || ""}`}>
                            {asset.category}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === asset.id ? null : asset.id);
                                }}
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                title="Actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-foreground">{asset.name}</h3>
                        <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(asset.estimated_value)}</p>
                        {asset.description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Context Menu */}
                  {isAdmin && openMenuId === asset.id && (
                    <div className="absolute right-2 top-12 z-10 min-w-[160px] rounded-lg border border-border bg-card shadow-lg py-1">
                      <button
                        onClick={(e) => { e.preventDefault(); openEditModal(asset); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Edit Asset
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/upload?asset=${asset.id}&year=${new Date().getFullYear()}`;
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                      >
                        <Upload className="h-3 w-3" /> Upload Budget
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); setDeleteTarget(asset); setOpenMenuId(null); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-muted"
                      >
                        <Trash2 className="h-3 w-3" /> Remove Asset
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.main>

      {/* ═══ ADD / EDIT MODAL ═══ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground">{editingAsset ? "Edit Asset" : "Add Asset"}</h2>
                <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Category selector */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
                  <div className="flex gap-2">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFormCategory(opt.value)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          formCategory === opt.value
                            ? `${opt.color} border-current`
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Asset Name *</label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Aspen Mountain Estate" />
                </div>

                {/* Value */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Estimated Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder="45000000"
                      className="pl-7"
                    />
                  </div>
                </div>

                {/* Identifier */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Identifier <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={formIdentifier} onChange={(e) => setFormIdentifier(e.target.value)} placeholder="e.g. N650GS, parcel ID" />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of the asset"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                {formError && <p className="text-sm text-red-400">{formError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingAsset ? "Save Changes" : "Add Asset"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Remove Asset</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Are you sure you want to remove this asset?</p>
              <div className="rounded-lg border border-border bg-background/50 p-3 mb-4">
                <p className="text-sm font-semibold text-foreground">{deleteTarget.name}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(deleteTarget.estimated_value)}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Remove
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
