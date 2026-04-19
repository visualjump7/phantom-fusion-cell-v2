"use client";

/**
 * DailyBriefWorkspace — staff-only Daily Brief hub for the command overlay.
 *
 * Two view modes (mutually exclusive — only one visible at a time):
 *   - "list":   ClientPicker + 2-button toggle [Briefs | + New Brief] + BriefList
 *   - "edit":   Back-to-Briefs button + ONLY the MiniComposer for the
 *               selected brief (no list visible — keeps focus on the brief)
 *
 * Transitions:
 *   - Click "Briefs" toggle  → view = "list"
 *   - Click "+ New Brief"    → create a draft, jump to view = "edit"
 *   - Click a brief in list  → view = "edit" with that brief
 *   - Click "Back to Briefs" → view = "list" (keeps selection so the row
 *                              is highlighted on return)
 *   - Brief deleted in composer → view = "list", clear selection
 *
 * Effective org comes from useEffectiveOrgId(); clientName from the active
 * principal so the cover-page settings card can preview correctly.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useActivePrincipal,
  useEffectiveOrgId,
} from "@/lib/use-active-principal";
import { createBrief, deleteBrief } from "@/lib/brief-service";
import { ClientPicker } from "./ClientPicker";
import { BriefList } from "./BriefList";
import { MiniComposer } from "./MiniComposer";

type View = "list" | "edit";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DailyBriefWorkspace() {
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const { activePrincipal } = useActivePrincipal();
  const clientName = activePrincipal?.displayName || "";

  const [view, setView] = useState<View>("list");
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [creating, setCreating] = useState(false);

  // When the active client changes, drop the current selection and bounce
  // back to the list so we don't keep editing a brief from a different org.
  useEffect(() => {
    setSelectedBriefId(null);
    setView("list");
  }, [orgId]);

  const refreshList = () => setListRefreshKey((k) => k + 1);

  const handleCreate = async () => {
    if (!orgId) return;
    setCreating(true);
    const brief = await createBrief(orgId, "Daily Brief", todayISO());
    setCreating(false);
    if (brief) {
      setSelectedBriefId(brief.id);
      setView("edit");
      refreshList();
    }
  };

  const handleSelectFromList = (briefId: string) => {
    setSelectedBriefId(briefId);
    setView("edit");
  };

  const handleDeleteFromList = async (briefId: string) => {
    const ok = await deleteBrief(briefId);
    if (!ok) return;
    // If we just deleted the brief currently open in the composer, drop
    // the selection and bounce back to the list view (we're already there
    // when delete is triggered from the row, but defensive in case we
    // later wire deletion from elsewhere).
    if (briefId === selectedBriefId) {
      setSelectedBriefId(null);
      setView("list");
    }
    refreshList();
  };

  const handleBackToList = () => {
    setView("list");
  };

  // ─── EDIT view: only the composer is shown ─────────────────────────────
  if (view === "edit" && selectedBriefId && orgId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Briefs
          </Button>
        </div>

        <MiniComposer
          // Reset internal composer state when the briefId changes.
          key={selectedBriefId}
          briefId={selectedBriefId}
          orgId={orgId}
          clientName={clientName}
          onChanged={refreshList}
          onDeleted={() => {
            setSelectedBriefId(null);
            setView("list");
            refreshList();
          }}
        />
      </div>
    );
  }

  // ─── LIST view: client picker + two-button toggle + briefs list ────────
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center">
        <ClientPicker />
      </div>

      {/* Two-button mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setView("list");
            setSelectedBriefId(null);
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors"
        >
          <FileText className="h-4 w-4" />
          Briefs
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!orgId || creating}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New Brief
        </button>
      </div>

      {/* Briefs list */}
      <section>
        {orgLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <BriefList
            orgId={orgId}
            selectedBriefId={selectedBriefId}
            onSelect={handleSelectFromList}
            onDelete={handleDeleteFromList}
            refreshKey={listRefreshKey}
          />
        )}
      </section>
    </div>
  );
}
