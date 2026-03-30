"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { updateDelegateAccess, DelegateUser } from "@/lib/delegate-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Asset {
  id: string;
  name: string;
  category: string;
}

interface EditDelegateAccessModalProps {
  orgId: string;
  delegate: DelegateUser;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDelegateAccessModal({ orgId, delegate, onClose, onSuccess }: EditDelegateAccessModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(delegate.assigned_assets.map((a) => a.id))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAssets() {
      const { data } = await db
        .from("assets")
        .select("id, name, category")
        .eq("organization_id", orgId)
        .eq("is_deleted", false)
        .order("category")
        .order("name");
      setAssets(data || []);
      setIsLoading(false);
    }
    loadAssets();
  }, [orgId]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleCategory = (category: string) => {
    const catAssets = assets.filter((a) => a.category === category);
    const allSelected = catAssets.every((a) => selectedIds.has(a.id));
    const next = new Set(selectedIds);
    catAssets.forEach((a) => {
      if (allSelected) next.delete(a.id); else next.add(a.id);
    });
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const grouped = assets.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, Asset[]>);

  const handleSave = async () => {
    if (selectedIds.size === 0) { setError("Select at least one project"); return; }
    setIsSaving(true);
    setError(null);

    const ok = await updateDelegateAccess(delegate.user_id, orgId, Array.from(selectedIds));
    if (ok) {
      onSuccess();
    } else {
      setError("Failed to update access");
    }
    setIsSaving(false);
  };

  const categoryColors: Record<string, string> = {
    family: "text-emerald-400",
    business: "text-blue-400",
    personal: "text-violet-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Edit Access</h2>
              <p className="text-xs text-muted-foreground">{delegate.full_name} ({delegate.email})</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select All */}
            <label className="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30">
              <input
                type="checkbox"
                checked={selectedIds.size === assets.length && assets.length > 0}
                onChange={toggleAll}
                className="rounded border-border"
              />
              <span className="text-sm font-medium text-foreground">Select All</span>
            </label>

            {Object.entries(grouped).map(([category, catAssets]) => {
              const allChecked = catAssets.every((a) => selectedIds.has(a.id));
              return (
                <div key={category} className="mb-3">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                  >
                    <span className={categoryColors[category] || "text-muted-foreground"}>
                      {category} Holdings
                    </span>
                    <span className="text-muted-foreground">
                      {allChecked ? "(deselect)" : "(select all)"}
                    </span>
                  </button>
                  <div className="space-y-1 pl-1">
                    {catAssets.map((asset) => (
                      <label
                        key={asset.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/30"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(asset.id)}
                          onChange={() => toggle(asset.id)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">{asset.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-muted-foreground">
              {selectedIds.size} project{selectedIds.size !== 1 ? "s" : ""} selected
            </p>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Access
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
