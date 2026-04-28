"use client";

/**
 * ThreadList — rows of threads the current user belongs to.
 *
 * Rendered in both the principal (/chat) and director (/admin/client/[orgId]/chat)
 * surfaces. Role-aware via the `canCreate` prop — controls the visibility of
 * the "New conversation" button.
 *
 * Phase 1: unread dot renders as a data attribute only (no count logic yet —
 * Phase 2 wires that). We leave the placeholder here so the DOM structure is
 * stable across phases.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, MessageCircle } from "lucide-react";
import {
  deriveThreadDisplayTitle,
  type ChatThread,
} from "@/lib/chat-service";
import { cn } from "@/lib/utils";

export interface ThreadListProps {
  threads: ChatThread[];
  currentUserId: string | null | undefined;
  /** Where clicking a row should route (e.g. `/comms/chat` or `/admin/client/orgId/comms/chat`). */
  baseHref: string;
  /**
   * When provided, clicking a row fires this callback with the thread id
   * instead of navigating via Link. Used when the list is embedded (e.g.
   * inside the command overlay) so selection stays in-frame.
   */
  onThreadClick?: (threadId: string) => void;
  /** Currently-open thread id (row renders highlighted). */
  activeThreadId?: string | null;
  /** When true, render a "New conversation" button. Admin-only in Phase 1. */
  canCreate?: boolean;
  onCreateClick?: () => void;
  emptyStateLabel?: string;
  isLoading?: boolean;
}

function formatRelativeShort(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function ThreadList({
  threads,
  currentUserId,
  baseHref,
  onThreadClick,
  activeThreadId,
  canCreate = false,
  onCreateClick,
  emptyStateLabel = "No conversations yet",
  isLoading = false,
}: ThreadListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[length:var(--font-size-section-header)] font-semibold text-foreground">
          Secure Chat
        </h2>
        {canCreate && (
          <button
            type="button"
            onClick={onCreateClick}
            className="flex min-h-[var(--tap-target-min)] items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg bg-muted/30"
              />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{emptyStateLabel}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {threads.map((thread, idx) => {
              const title = deriveThreadDisplayTitle(thread, currentUserId);
              const preview = thread.last_message?.body?.trim() || "No messages yet";
              const senderFirst =
                (thread.last_message?.sender_name || "").trim().split(/\s+/)[0] || "";
              const hasUnread = (thread.unread_count ?? 0) > 0; // Phase 2
              const isActive = activeThreadId === thread.id;

              const rowClasses = cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                isActive
                  ? "bg-primary/10"
                  : "hover:bg-muted/30",
                hasUnread && "bg-muted/10"
              );

              const rowBody = (
                <>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[14px]",
                          hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                        )}
                      >
                        {title}
                      </span>
                      {thread.last_message && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatRelativeShort(thread.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {senderFirst && thread.last_message?.body ? `${senderFirst}: ` : ""}
                      {preview}
                    </p>
                  </div>
                  {hasUnread && (
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      data-unread-count={thread.unread_count ?? 0}
                    />
                  )}
                </>
              );

              return (
                <motion.li
                  key={thread.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.25 }}
                >
                  {onThreadClick ? (
                    <button
                      type="button"
                      onClick={() => onThreadClick(thread.id)}
                      className={rowClasses}
                    >
                      {rowBody}
                    </button>
                  ) : (
                    <Link href={`${baseHref}/${thread.id}`} className={rowClasses}>
                      {rowBody}
                    </Link>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
