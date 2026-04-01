"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Asset {
  id: string;
  name: string;
  category: string;
}

interface InviteDelegateModalProps {
  orgId: string;
  grantedBy: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteDelegateModal({ orgId, grantedBy, onClose, onSuccess }: InviteDelegateModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (selectedIds.size === 0) { setError("Select at least one project"); return; }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/invite-delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          orgId,
          assetIds: Array.from(selectedIds),
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setSuccessMsg("Delegate invited. They will receive a login email.");
        setTimeout(onSuccess, 2000);
      } else {
        setError(result.error || "Failed to invite delegate");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite delegate");
    }
    setIsSaving(false);
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
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Add Delegate</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name *</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Smith" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Email *</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>

          {/* Project assignment */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Project Access *</label>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Select All */}
                <label className="flex items-center gap-2 rounded-lg border border-border p-2.5 mb-3 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === assets.length && assets.length > 0}
                    onChange={toggleAll}
                    className="rounded border-border"
                  />
                  <span className="text-sm font-medium text-foreground">Select All</span>
                  <span className="text-xs text-muted-foreground">({assets.length} projects)</span>
                </label>

                {/* Category groups */}
                {Object.entries(grouped).map(([category, catAssets]) => {
                  const allChecked = catAssets.every((a) => selectedIds.has(a.id));
                  const categoryColors: Record<string, string> = {
                    family: "text-emerald-400",
                    business: "text-blue-400",
                    personal: "text-violet-400",
                  };
                  return (
                    <div key={category} className="mb-3">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                      >
                        <span className={categoryColors[category] || "text-muted-foreground"}>
                          {category} Projects
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
              </>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              {selectedIds.size} project{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {successMsg && <p className="text-sm text-emerald-400">{successMsg}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Delegate
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
