"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, XCircle, Building2 } from "lucide-react";
import { fetchMessageById, respondToMessage } from "@/lib/message-service";
import type { Message } from "@/lib/message-service";
import type { PanelMessage } from "@/components/map/LeftStatPanel";

/* ────────────────── Priority config ────────────────── */

const PRIORITY_DOT: Record<string, { className: string; label: string }> = {
  urgent: { className: "bg-red-500", label: "Urgent" },
  high: { className: "bg-orange-400", label: "High" },
  medium: { className: "bg-blue-400", label: "Updates" },
  low: { className: "bg-white/30", label: "Low" },
};

const TYPE_DOT: Record<string, { className: string; label: string }> = {
  decision: { className: "bg-amber-500", label: "Decision" },
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ────────────────── Props ────────────────── */

interface DecisionModalProps {
  message: PanelMessage | null;
  onClose: () => void;
  onActionComplete: () => void;
}

/* ────────────────── Component ────────────────── */

export function DecisionModal({
  message,
  onClose,
  onActionComplete,
}: DecisionModalProps) {
  const [fullMessage, setFullMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);

  // Fetch full message when opened
  useEffect(() => {
    if (!message) {
      setFullMessage(null);
      setNote("");
      setSubmitting(null);
      setToast(null);
      return;
    }
    setLoading(true);
    fetchMessageById(message.id).then((msg) => {
      setFullMessage(msg);
      setLoading(false);
    });
  }, [message]);

  // Escape key handler
  useEffect(() => {
    if (!message) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [message, onClose]);

  const handleAction = useCallback(
    async (action: "approved" | "rejected") => {
      if (!message || submitting) return;
      setSubmitting(action);
      const result = await respondToMessage(
        message.id,
        action,
        note.trim() || undefined
      );
      if (result.success) {
        setToast(action === "approved" ? "Decision approved" : "Decision rejected");
        setTimeout(() => {
          onClose();
          onActionComplete();
        }, 800);
      } else {
        setSubmitting(null);
        setToast(`Error: ${result.error || "Unknown error"}`);
        setTimeout(() => setToast(null), 3000);
      }
    },
    [message, note, submitting, onClose, onActionComplete]
  );

  const dot =
    TYPE_DOT[message?.type ?? ""] ?? PRIORITY_DOT[message?.priority ?? "low"];

  return (
    <AnimatePresence>
      {message && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-[100] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl"
            style={{ padding: "var(--card-padding, 24px)" }}
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot.className}`}
                />
                <h2
                  className="font-semibold text-[var(--text-primary)] truncate"
                  style={{ fontSize: "var(--font-size-section-header, 18px)" }}
                >
                  {message.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Metadata ── */}
            <div className="flex items-center gap-3 mb-4">
              {message.asset_name && (
                <a
                  href={`/assets/${message.asset_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                  style={{ fontSize: "var(--font-size-caption, 12px)" }}
                >
                  <Building2 className="h-3 w-3" />
                  {message.asset_name}
                </a>
              )}
              <span
                className="text-[var(--text-secondary)]"
                style={{ fontSize: "var(--font-size-caption, 12px)" }}
              >
                {timeAgo(message.created_at)}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[var(--text-secondary)] bg-[var(--border-color)]"
                style={{ fontSize: "10px" }}
              >
                {dot.label}
              </span>
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-[var(--border-color)] mb-4" />

            {/* ── Body ── */}
            <div
              className="overflow-y-auto mb-4"
              style={{ maxHeight: "60vh" }}
            >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" />
                </div>
              ) : (
                <div
                  className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed"
                  style={{ fontSize: "var(--font-size-body, 14px)" }}
                >
                  {fullMessage?.body || (
                    <span className="text-[var(--text-secondary)] italic">
                      No additional details provided.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-[var(--border-color)] mb-4" />

            {/* ── Action Section ── */}
            <div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note with your reasoning..."
                rows={2}
                className="w-full rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
                style={{
                  fontSize: "var(--font-size-body, 14px)",
                  minHeight: "var(--tap-target-min, 44px)",
                }}
              />
              <div className="flex items-center justify-end gap-3 mt-3">
                <button
                  onClick={() => handleAction("rejected")}
                  disabled={!!submitting}
                  className="rounded-lg border border-[var(--border-color)] px-4 text-[var(--text-secondary)] hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  style={{
                    height: "var(--button-height, 44px)",
                    fontSize: "var(--font-size-body, 14px)",
                  }}
                >
                  {submitting === "rejected" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject
                </button>
                <button
                  onClick={() => handleAction("approved")}
                  disabled={!!submitting}
                  className="rounded-lg bg-[var(--accent-primary)] px-4 text-white font-medium hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  style={{
                    height: "var(--button-height, 44px)",
                    fontSize: "var(--font-size-body, 14px)",
                  }}
                >
                  {submitting === "approved" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve
                </button>
              </div>
            </div>

            {/* ── Toast ── */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-white text-sm font-medium shadow-lg"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
