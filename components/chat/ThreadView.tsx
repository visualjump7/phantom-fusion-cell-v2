"use client";

/**
 * ThreadView — message list + composer for a single thread.
 *
 * Subscribes to the Realtime postgres_changes INSERT stream filtered by
 * thread_id so other participants' messages appear within ~1 second. Own
 * sends use an optimistic append keyed by a temporary id, reconciled when
 * the real row arrives (either from the sendMessage() response or from the
 * realtime subscription, whichever lands first).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import {
  fetchMessages,
  fetchThreadById,
  sendMessage,
  deriveThreadDisplayTitle,
  type ChatMessage,
  type ChatThread,
} from "@/lib/chat-service";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";

export interface ThreadViewProps {
  threadId: string;
  /** Where the back arrow routes when used as a full-page view. */
  backHref: string;
  /**
   * When provided, the back arrow fires this callback instead of Link-
   * navigating. Used when the view is embedded (e.g. inside the command
   * overlay) so the close stays in-frame.
   */
  onBack?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realtimeClient = supabase as any;

interface PendingMessage extends ChatMessage {
  _tempId: string;
  _status: "sending" | "failed";
}

type DisplayMessage = ChatMessage | PendingMessage;

function isPending(msg: DisplayMessage): msg is PendingMessage {
  return "_tempId" in msg;
}

/** Round-trip boundary for "group messages by minute" visually. */
function groupBoundary(a: DisplayMessage, b: DisplayMessage | null): boolean {
  if (!b) return true;
  if (a.sender_id !== b.sender_id) return true;
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  return Math.abs(ta - tb) > 60_000;
}

export function ThreadView({ threadId, backHref, onBack }: ThreadViewProps) {
  const { userId } = useRole();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);

  // Load thread + message history.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchThreadById(threadId), fetchMessages(threadId, { limit: 50 })])
      .then(([t, msgs]) => {
        if (cancelled) return;
        setThread(t);
        // Service returns newest-first; display oldest-first.
        setMessages(msgs.slice().reverse());
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[chat-thread-load]", err);
        setError("Could not load this conversation");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Realtime subscription — INSERTs on chat_messages filtered by thread_id.
  useEffect(() => {
    const channel = realtimeClient
      .channel(`chat:thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new as ChatMessage;
          // Hydrate minimal shape — sender_name will populate after a
          // follow-up fetch only when needed. For own messages, we already
          // have sender_name from the optimistic insert path.
          setMessages((prev) => {
            // Dedup: if an existing real message has the same id, skip.
            if (prev.some((m) => !isPending(m) && m.id === row.id)) return prev;
            // Reconcile any pending optimistic entry from the same sender
            // whose body matches — if found, replace it in place.
            const idx = prev.findIndex(
              (m) =>
                isPending(m) &&
                m.sender_id === row.sender_id &&
                m.body === row.body
            );
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = {
                ...row,
                // Keep the sender_name from the optimistic entry if we have it.
                sender_name: (prev[idx] as PendingMessage).sender_name ?? null,
              };
              return next;
            }
            return [...prev, { ...row, sender_name: null }];
          });
        }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `thread_id=eq.${threadId}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const row = payload.new as ChatMessage;
        // Soft-delete propagation, etc.
        setMessages((prev) =>
          prev.map((m) => (!isPending(m) && m.id === row.id ? { ...m, ...row } : m))
        );
      })
      .subscribe();

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [threadId]);

  // Track whether the user is near the bottom before new messages arrive.
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasNearBottomRef.current = distance < 120;
  }, []);

  // Auto-scroll to bottom on new messages *if* the user was near the bottom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (wasNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // On initial load, scroll to bottom unconditionally.
  useEffect(() => {
    if (loading) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [loading]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!userId) return;
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: PendingMessage = {
        _tempId: tempId,
        _status: "sending",
        id: tempId,
        thread_id: threadId,
        organization_id: thread?.organization_id ?? "",
        sender_id: userId,
        sender_name: null, // MessageBubble uses isOwn for layout, so name is optional here
        body,
        has_attachments: false,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date().toISOString(),
      };
      wasNearBottomRef.current = true;
      setMessages((prev) => [...prev, optimistic]);

      const result = await sendMessage(threadId, body);
      if (!result.success || !result.message) {
        setMessages((prev) =>
          prev.map((m) =>
            isPending(m) && m._tempId === tempId
              ? { ...m, _status: "failed" as const }
              : m
          )
        );
        return;
      }

      // Reconcile: replace the pending entry with the real row, unless the
      // realtime subscription already did it.
      setMessages((prev) => {
        const hasReal = prev.some(
          (m) => !isPending(m) && m.id === result.message!.id
        );
        if (hasReal) {
          // Realtime beat us; just drop the pending one.
          return prev.filter((m) => !(isPending(m) && m._tempId === tempId));
        }
        return prev.map((m) =>
          isPending(m) && m._tempId === tempId ? (result.message as ChatMessage) : m
        );
      });
    },
    [threadId, thread?.organization_id, userId]
  );

  const title = thread ? deriveThreadDisplayTitle(thread, userId) : "Secure Chat";
  const participantSummary = thread
    ? thread.participants
        .filter((p) => !p.left_at)
        .map((p) => (p.name || "").split(/\s+/)[0])
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-3 sm:px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[length:var(--font-size-body)] font-semibold text-foreground">
            {loading ? "Loading…" : title}
          </h1>
          {!loading && participantSummary && (
            <p className="truncate text-[11px] text-muted-foreground">{participantSummary}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading messages…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-red-400">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No messages yet. Say hello.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((m, idx) => {
              const isOwn = m.sender_id === userId;
              const prev = idx > 0 ? messages[idx - 1] : null;
              const next = idx < messages.length - 1 ? messages[idx + 1] : null;
              const showSenderName = !isOwn && groupBoundary(m, prev);
              const showTimestamp = next === null ? true : groupBoundary(next, m);
              const key = isPending(m) ? m._tempId : m.id;
              return (
                <MessageBubble
                  key={key}
                  message={m}
                  isOwn={isOwn}
                  showSenderName={showSenderName}
                  showTimestamp={showTimestamp}
                  pendingStatus={isPending(m) ? m._status : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer onSend={handleSend} disabled={loading || !!error} />
    </div>
  );
}
