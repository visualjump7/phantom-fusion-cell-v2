"use client";

/**
 * Principles — per-org list of standing principles (title + description).
 *
 * The Fusion Cell team adds / edits / removes principles here. Executives
 * in the org see them read-only (this page is admin-only via the
 * /admin/client/[orgId] route gate). v1 is a flat list; reordering will
 * land later (rows already carry a `position` column).
 *
 * Patterns mirror principal-experience/page.tsx: optimistic updates,
 * useActionGuard so preview-mode disables writes.
 */

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  X as XIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientContext } from "@/lib/use-client-context";
import { useActionGuard } from "@/lib/use-action-guard";
import {
  fetchPrinciples,
  createPrinciple,
  updatePrinciple,
  deletePrinciple,
  type Principle,
} from "@/lib/principles-service";

export default function PrinciplesPage() {
  const { orgId, clientName } = useClientContext();
  const { blocked, guardClick } = useActionGuard();

  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPrinciples(orgId).then((rows) => {
      if (cancelled) return;
      setPrinciples(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function handleAdd() {
    const title = draftTitle.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createPrinciple(orgId, {
      title,
      description: draftDescription,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setPrinciples((prev) => [...prev, res.principle]);
    setDraftTitle("");
    setDraftDescription("");
  }

  async function handleDelete(id: string) {
    // Optimistic: drop immediately, restore on failure.
    const previous = principles;
    setPrinciples((p) => p.filter((x) => x.id !== id));
    const res = await deletePrinciple(id);
    if (!res.success) {
      setPrinciples(previous);
      setError(res.error || "Couldn't delete principle.");
    }
  }

  function startEdit(p: Principle) {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditDescription(p.description);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const t = editTitle.trim();
    if (!t) {
      setError("Title can't be empty.");
      return;
    }
    setEditSaving(true);
    const res = await updatePrinciple(editingId, {
      title: t,
      description: editDescription,
    });
    setEditSaving(false);
    if (!res.success) {
      setError(res.error || "Couldn't save.");
      return;
    }
    setPrinciples((prev) =>
      prev.map((p) =>
        p.id === editingId
          ? { ...p, title: t, description: editDescription.trim() }
          : p
      )
    );
    cancelEdit();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Principles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Standing principles for {clientName}. Capture guiding rules and
          decision frames the team should keep in mind.
        </p>
      </div>

      {/* Add form */}
      <Card className="mb-6 border-border/60 bg-muted/20">
        <CardContent className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Title
            </label>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="e.g. Cash before complexity"
              disabled={saving || blocked}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </label>
            <textarea
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Why this principle matters and how to apply it."
              rows={3}
              disabled={saving || blocked}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={guardClick(handleAdd)}
              disabled={saving || blocked || !draftTitle.trim()}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add principle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {principles.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No principles yet. Add the first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {principles.map((p) => {
            const isEditing = editingId === p.id;
            return (
              <Card key={p.id} className="border-border bg-card/60">
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={editSaving}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        disabled={editSaving}
                        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          disabled={editSaving}
                          className="gap-1"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={guardClick(saveEdit)}
                          disabled={editSaving || blocked}
                          className="gap-1"
                        >
                          {editSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {p.title}
                        </p>
                        {p.description && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          aria-label="Edit principle"
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={guardClick(() => handleDelete(p.id))}
                          disabled={blocked}
                          aria-label="Delete principle"
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
