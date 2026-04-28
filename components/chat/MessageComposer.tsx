"use client";

/**
 * MessageComposer — auto-growing textarea + send button.
 *
 * Enter sends; Shift+Enter inserts a newline. Disabled while submitting
 * or when the trimmed body is empty.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessageComposerProps {
  onSend: (body: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
}

const MAX_HEIGHT_PX = 160;

export function MessageComposer({
  onSend,
  placeholder = "Type a message…",
  disabled = false,
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow: let the textarea resize up to MAX_HEIGHT_PX.
  const autosize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT_PX) + "px";
  }, []);

  useEffect(() => {
    autosize();
  }, [body, autosize]);

  const trimmed = body.trim();
  const canSend = !disabled && !submitting && trimmed.length > 0;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const toSend = trimmed;
    setSubmitting(true);
    try {
      await onSend(toSend);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }, [canSend, trimmed, onSend]);

  return (
    <div
      className="flex items-end gap-2 border-t border-border bg-background/80 px-3 py-2 backdrop-blur-sm"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled || submitting}
        rows={1}
        className="max-h-[160px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[14px] leading-snug text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
          canSend
            ? "bg-primary text-primary-foreground hover:brightness-110"
            : "bg-muted text-muted-foreground"
        )}
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
