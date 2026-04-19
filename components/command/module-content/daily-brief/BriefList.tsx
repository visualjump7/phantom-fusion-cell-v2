"use client";

/**
 * BriefList — read-only list of briefs for a given org.
 *
 * Re-fetches when `orgId` or `refreshKey` changes. Renders rows with date,
 * title, and a status pill. Selecting a row calls onSelect(briefId).
 *
 * Staff see all statuses (draft + published + archived). Principals only
 * see published — RLS at the DB level enforces this regardless of UI.
 */

import { useEffect, useState } from "react";
import { Loader2, FileText, Trash2 } from "lucide-react";
import { fetchBriefs, type Brief } from "@/lib/brief-service";

interface BriefListProps {
  orgId: string | null;
  selectedBriefId: string | null;
  onSelect: (briefId: string) => void;
  /** Optional — when provided, each row gets a trash button that calls
      this with the brief's id. Parent owns the actual delete + refresh. */
  onDelete?: (briefId: string) => void;
  /** Bump to force re-fetch (e.g. after creating a new brief). */
  refreshKey?: number;
}

const STATUS_PILL: Record<string, string> = {
  draft: "bg-yellow-600/20 text-yellow-300 border-yellow-600/30",
  published: "bg-emerald-600/20 text-emerald-300 border-emerald-600/30",
  archived: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};

function formatBriefDate(d: string): string {
  // brief_date is a YYYY-MM-DD string. Avoid Date(string) timezone shifts.
  const [y, m, day] = d.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !day) return d;
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BriefList({
  orgId,
  selectedBriefId,
  onSelect,
  onDelete,
  refreshKey = 0,
}: BriefListProps) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setBriefs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchBriefs(orgId).then((rows) => {
      if (cancelled) return;
      setBriefs(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  if (!orgId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Select a client to see their briefs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (briefs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 px-4 py-8 text-center">
        <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          No briefs yet for this client.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Click <span className="font-medium">+ New Brief</span> above to start one.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/40">
      {briefs.map((b) => {
        const selected = b.id === selectedBriefId;
        const pill = STATUS_PILL[b.status] || STATUS_PILL.draft;
        return (
          <li
            key={b.id}
            className={`group flex items-center gap-1 transition-colors ${
              selected ? "bg-primary/10" : "hover:bg-muted/60"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(b.id)}
              className="flex flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {b.title || "Untitled brief"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBriefDate(b.brief_date)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${pill}`}
              >
                {b.status}
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    confirm(
                      `Delete "${b.title || "Untitled brief"}"? This cannot be undone.`
                    )
                  ) {
                    onDelete(b.id);
                  }
                }}
                aria-label={`Delete ${b.title || "brief"}`}
                title="Delete brief"
                className="mr-2 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
