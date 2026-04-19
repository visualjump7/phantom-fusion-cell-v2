"use client";

/**
 * MiniComposer — overlay-friendly brief editor.
 *
 * Modeled after the admin composer at
 * `app/admin/client/[orgId]/briefs/[briefId]/page.tsx` but trimmed for an
 * overlay context. We deliberately skip:
 *   - document-block uploads (still editable in the admin route)
 *   - drag-and-drop reorder (use up/down buttons instead)
 *   - the live PDF preview pane
 *
 * Cover-page settings ARE included via the same `CoverPageSettings`
 * component used by the admin route (collapsible card, doesn't take
 * vertical space until expanded).
 *
 * Reuses the existing block editor (`components/brief/BriefBlockEditor.tsx`)
 * and all service-layer functions in `lib/brief-service.ts` — no new
 * Supabase calls here.
 *
 * Live data (cashflow / bills_7,14,30 / projects / decisions) is fetched
 * once when the brief loads and passed down to BriefBlockEditor; this is
 * the same shape the admin composer uses.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Send,
  Type,
  DollarSign,
  Receipt,
  Building2,
  AlertTriangle,
  CalendarDays,
  X,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BriefBlockEditor } from "@/components/brief/BriefBlockEditor";
import { CoverPageSettings } from "@/components/brief/CoverPageSettings";
import {
  fetchBrief,
  updateBrief,
  publishBrief,
  unpublishBrief,
  deleteBrief,
  addBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  fetchCashFlowData,
  fetchUpcomingBillsData,
  fetchProjectsSnapshot,
  fetchPendingDecisions,
  fetchScheduleData,
  type Brief,
  type BriefBlock,
  type CashFlowBlockData,
  type BillBlockData,
  type ProjectsBlockData,
  type DecisionsBlockData,
  type ScheduleBlockData,
} from "@/lib/brief-service";
import { useRole } from "@/lib/use-role";

interface MiniComposerProps {
  briefId: string;
  orgId: string;
  /** Client display name — used by CoverPageSettings as the cover preview
      fallback when no custom subtitle is set. Pass "" if unknown. */
  clientName: string;
  /** Called whenever the brief is mutated in a way the list cares about
      (status flip, title/date change, delete) so the parent can refresh. */
  onChanged?: () => void;
  /** Called when the brief is deleted. Parent should clear selection. */
  onDeleted?: () => void;
}

// Block types available in the overlay composer. `document` is intentionally
// omitted — uploads stay in the admin route.
const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: Type, desc: "Rich text commentary" },
  { type: "cashflow", label: "Cash Flow", icon: DollarSign, desc: "Monthly summary" },
  { type: "bills", label: "Upcoming Bills", icon: Receipt, desc: "Bills due soon" },
  { type: "schedule", label: "Schedule", icon: CalendarDays, desc: "Bills + decisions + travel + manual items" },
  { type: "projects", label: "Projects", icon: Building2, desc: "Projects snapshot" },
  { type: "decisions", label: "Decisions", icon: AlertTriangle, desc: "Pending decisions" },
] as const;

const STATUS_PILL: Record<string, string> = {
  draft: "bg-yellow-600/20 text-yellow-300 border-yellow-600/30",
  published: "bg-emerald-600/20 text-emerald-300 border-emerald-600/30",
  archived: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};

export function MiniComposer({
  briefId,
  orgId,
  clientName,
  onChanged,
  onDeleted,
}: MiniComposerProps) {
  const { userId } = useRole();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  // Inline banner for user-visible problems: add-block errors (e.g. DB CHECK
  // constraint on `type`) and partial live-data failures (e.g. calendar
  // tables not yet migrated). Kept as a single array so both surface in
  // the same space above the blocks.
  const [errors, setErrors] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load brief + blocks
  const loadBrief = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrief(briefId);
    setBrief(data);
    setLoading(false);
  }, [briefId]);

  // Load live data. Every fetcher is wrapped in its own .catch() with a
  // JSON-safe fallback so one failure (e.g. calendar tables not yet
  // migrated on this env) doesn't reject the whole Promise.all and leave
  // every data block showing its loading spinner forever. Any fetcher
  // that fell back gets its label pushed onto `errors` so the UI can
  // explain why that block is empty.
  const loadLiveData = useCallback(async () => {
    const failed: string[] = [];
    const guard = <T,>(label: string, fallback: T) =>
      (p: Promise<T>): Promise<T> =>
        p.catch((err) => {
          console.error(`[MiniComposer] ${label} failed`, err);
          failed.push(label);
          return fallback;
        });

    const now = new Date();
    const cashflowFallback: CashFlowBlockData = {
      month: now.toLocaleString("default", { month: "long" }),
      year: now.getFullYear(),
      cashIn: 0,
      cashOut: 0,
      net: 0,
      paidCount: 0,
      pendingCount: 0,
    };
    const billsFallback = (d: number): BillBlockData => ({
      bills: [],
      total: 0,
      daysAhead: d,
    });
    const projectsFallback: ProjectsBlockData = {
      projects: [],
      totalValue: 0,
      category: null,
    };
    const decisionsFallback: DecisionsBlockData = {
      decisions: [],
      count: 0,
    };
    const scheduleFallback = (d: number): ScheduleBlockData => ({
      events: [],
      daysAhead: d,
    });

    const [
      cashflow,
      bills7,
      bills14,
      bills30,
      projects,
      decisions,
      schedule7,
      schedule14,
      schedule30,
    ] = await Promise.all([
      guard("Cash flow", cashflowFallback)(fetchCashFlowData(orgId)),
      guard("Bills (7d)", billsFallback(7))(fetchUpcomingBillsData(orgId, 7)),
      guard("Bills (14d)", billsFallback(14))(fetchUpcomingBillsData(orgId, 14)),
      guard("Bills (30d)", billsFallback(30))(fetchUpcomingBillsData(orgId, 30)),
      guard("Projects", projectsFallback)(fetchProjectsSnapshot(orgId)),
      guard("Decisions", decisionsFallback)(fetchPendingDecisions(orgId)),
      guard("Schedule (7d)", scheduleFallback(7))(fetchScheduleData(orgId, 7)),
      guard("Schedule (14d)", scheduleFallback(14))(fetchScheduleData(orgId, 14)),
      guard("Schedule (30d)", scheduleFallback(30))(fetchScheduleData(orgId, 30)),
    ]);
    setLiveData({
      cashflow,
      bills_7: bills7,
      bills_14: bills14,
      bills_30: bills30,
      projects,
      decisions,
      schedule_7: schedule7,
      schedule_14: schedule14,
      schedule_30: schedule30,
    });
    if (failed.length > 0) {
      setErrors((prev) => [
        ...prev,
        `Couldn't load: ${failed.join(", ")}. Those blocks will show empty.`,
      ]);
    }
  }, [orgId]);

  useEffect(() => {
    loadBrief();
    loadLiveData();
  }, [loadBrief, loadLiveData]);

  // Close block picker on outside click
  useEffect(() => {
    if (!showBlockPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowBlockPicker(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showBlockPicker]);

  // Title / date — optimistic update, fire-and-forget save
  const handleTitleChange = async (title: string) => {
    if (!brief) return;
    setBrief({ ...brief, title });
    await updateBrief(briefId, { title });
    onChanged?.();
  };

  const handleDateChange = async (briefDate: string) => {
    if (!brief) return;
    setBrief({ ...brief, brief_date: briefDate });
    await updateBrief(briefId, { brief_date: briefDate });
    onChanged?.();
  };

  // Block ops — same pattern as admin composer
  const handleAddBlock = async (type: string) => {
    if (!brief) return;
    const position = brief.blocks?.length || 0;
    const defaultConfig: Record<string, unknown> = {};
    if (type === "bills") defaultConfig.days_ahead = 7;
    if (type === "projects") defaultConfig.category = "all";
    if (type === "schedule") {
      defaultConfig.days_ahead = 7;
      defaultConfig.items = [];
    }

    // addBlock now returns { block, error } — unwrap and surface failures
    // instead of silently pushing the wrapper object into brief.blocks
    // (which would leave the new block with no .id/.type and render empty).
    const result = await addBlock(briefId, type, position, defaultConfig);
    if (result.error) {
      setErrors((prev) => [
        ...prev,
        `Couldn't add ${type} block: ${result.error}`,
      ]);
    } else if (result.block) {
      setBrief({
        ...brief,
        blocks: [...(brief.blocks || []), result.block],
      });
    }
    setShowBlockPicker(false);
  };

  const handleUpdateBlock = async (
    blockId: string,
    updates: Partial<Pick<BriefBlock, "content_html" | "config" | "commentary">>
  ) => {
    await updateBlock(blockId, updates);
    if (brief?.blocks) {
      setBrief({
        ...brief,
        blocks: brief.blocks.map((b) =>
          b.id === blockId ? { ...b, ...updates } : b
        ),
      });
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock(blockId);
    if (brief?.blocks) {
      setBrief({
        ...brief,
        blocks: brief.blocks.filter((b) => b.id !== blockId),
      });
    }
  };

  const handleMoveBlock = async (blockId: string, direction: "up" | "down") => {
    if (!brief?.blocks) return;
    const blocks = [...brief.blocks];
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;

    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    const reordered = blocks.map((b, i) => ({ ...b, position: i }));
    setBrief({ ...brief, blocks: reordered });
    await reorderBlocks(briefId, reordered.map((b) => b.id));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateBrief(briefId, { status: "draft" });
    setSaving(false);
    onChanged?.();
  };

  const handlePublish = async () => {
    if (!userId) return;
    setSaving(true);
    const ok = await publishBrief(briefId, userId);
    if (ok && brief) {
      setBrief({
        ...brief,
        status: "published",
        published_at: new Date().toISOString(),
      });
    }
    setSaving(false);
    onChanged?.();
  };

  const handleUnpublish = async () => {
    setSaving(true);
    const ok = await unpublishBrief(briefId);
    if (ok && brief) {
      setBrief({
        ...brief,
        status: "draft",
        published_at: null,
        published_by: null,
      });
    }
    setSaving(false);
    onChanged?.();
  };

  const handleCoverUpdate = async (updates: Partial<Brief>) => {
    if (!brief) return;
    setBrief({ ...brief, ...updates });
    // updateBrief's type accepts only cover_* fields from Partial<Brief>;
    // cast narrows the union for the service call.
    await updateBrief(
      briefId,
      updates as Parameters<typeof updateBrief>[1]
    );
    onChanged?.();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this brief? This cannot be undone.")) return;
    setSaving(true);
    const ok = await deleteBrief(briefId);
    setSaving(false);
    if (ok) {
      onDeleted?.();
    }
  };

  if (loading || !brief) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPublished = brief.status === "published";

  return (
    <div className="space-y-4">
      {/* Header: title + date + actions */}
      <Card className="border-border bg-card/60">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={brief.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Brief title…"
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Badge
              variant="outline"
              className={STATUS_PILL[brief.status] || ""}
            >
              {brief.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Date:
              <input
                type="date"
                value={brief.brief_date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
              {isPublished ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnpublish}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Unpublish
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save
                  </Button>
                  <Button size="sm" onClick={handlePublish} disabled={saving}>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Publish
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inline error banner — shows add-block failures and any live-data
          fetchers that fell back to empty. Dismissible; re-populates if
          another error occurs. */}
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          <div className="flex items-start justify-between gap-3">
            <ul className="space-y-1">
              {errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setErrors([])}
              className="shrink-0 text-red-300/80 hover:text-red-200"
              aria-label="Dismiss errors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cover-page settings (collapsible — matches admin composer) */}
      <CoverPageSettings
        brief={brief}
        orgId={orgId}
        clientName={clientName}
        onUpdate={handleCoverUpdate}
      />

      {/* Blocks */}
      {brief.blocks?.map((block, index) => (
        <motion.div
          key={block.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
        >
          <Card className="border-border bg-card/60">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium capitalize text-foreground">
                  {block.type === "cashflow"
                    ? "Cash Flow"
                    : block.type === "bills"
                    ? "Upcoming Bills"
                    : block.type}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(block.id, "up")}
                    disabled={index === 0}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveBlock(block.id, "down")}
                    disabled={index === (brief.blocks?.length || 0) - 1}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(block.id)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remove block"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <BriefBlockEditor
                block={block}
                liveData={liveData}
                orgId={orgId}
                onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
              />
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Add block */}
      <div className="relative" ref={pickerRef}>
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowBlockPicker((v) => !v)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Block
        </Button>

        {showBlockPicker && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 top-full z-10 mt-2 grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-3 shadow-lg sm:grid-cols-2 md:grid-cols-3"
          >
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                type="button"
                onClick={() => handleAddBlock(bt.type)}
                className="flex items-center gap-2 rounded-lg p-3 text-left transition-colors hover:bg-muted"
              >
                <bt.icon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {bt.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {bt.desc}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
