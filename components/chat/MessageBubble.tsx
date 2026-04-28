"use client";

/**
 * MessageBubble — single chat message row.
 *
 * Kept intentionally small — this is the hot path during thread render.
 * Sender-right / others-left with the sender's first name rendered above
 * the bubble for non-self messages. Soft-deleted messages render as a
 * muted "Message deleted" tombstone.
 */

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat-service";

export interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  /** When true, render the sender name above the bubble (grouping boundary). */
  showSenderName: boolean;
  /** When true, render the timestamp below the bubble (grouping boundary). */
  showTimestamp: boolean;
  /** Optional transient status overlaid on own bubbles (optimistic send). */
  pendingStatus?: "sending" | "failed";
  onRetry?: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function MessageBubble({
  message,
  isOwn,
  showSenderName,
  showTimestamp,
  pendingStatus,
  onRetry,
}: MessageBubbleProps) {
  if (message.is_deleted) {
    return (
      <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
        <span className="rounded-xl bg-muted/30 px-3 py-1.5 text-[12px] italic text-muted-foreground">
          Message deleted
        </span>
      </div>
    );
  }

  const senderFirstName = (message.sender_name || "").trim().split(/\s+/)[0] || "";

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        isOwn ? "items-end" : "items-start"
      )}
    >
      {!isOwn && showSenderName && senderFirstName && (
        <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
          {senderFirstName}
        </span>
      )}

      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[14px] leading-snug sm:max-w-[70%]",
          isOwn
            ? "rounded-br-sm bg-primary/15 text-foreground"
            : "rounded-bl-sm bg-muted/40 text-foreground"
        )}
      >
        {message.body}
      </div>

      {(showTimestamp || pendingStatus) && (
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/80",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          {pendingStatus === "sending" && <span>Sending…</span>}
          {pendingStatus === "failed" && (
            <>
              <span className="text-red-400">Failed</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-primary hover:underline"
                >
                  Retry
                </button>
              )}
            </>
          )}
          {!pendingStatus && showTimestamp && <span>{formatTime(message.created_at)}</span>}
        </div>
      )}
    </div>
  );
}
