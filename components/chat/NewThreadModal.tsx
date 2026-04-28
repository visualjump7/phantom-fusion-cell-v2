"use client";

/**
 * NewThreadModal — director-only modal for starting a chat.
 *
 * Selects one principal + N directors from the organization_members for the
 * scoped org. Calls createThread() and routes to the new thread on success.
 *
 * Mirrors the shell pattern from components/admin/shared/InviteDelegateModal.tsx
 * (fixed overlay + backdrop + Framer Motion scale-in card).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Users, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import { createThread } from "@/lib/chat-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface NewThreadModalProps {
  open: boolean;
  onClose: () => void;
  /** Organization to scope the thread and candidate lookup to. */
  orgId: string;
  /** Where to route on success (the list page that shows this thread). */
  redirectBase: string;
}

interface Candidate {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "owner" | "admin" | "accountant" | "executive";
}

export function NewThreadModal({
  open,
  onClose,
  orgId,
  redirectBase,
}: NewThreadModalProps) {
  const router = useRouter();
  const { userId: selfId } = useRole();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedPrincipal, setSelectedPrincipal] = useState<string | null>(null);
  const [selectedDirectors, setSelectedDirectors] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load candidates for the org when opening.
  useEffect(() => {
    if (!open || !orgId) return;
    let cancelled = false;
    setLoadingCandidates(true);
    (async () => {
      const { data, error: err } = await db
        .from("organization_members")
        .select("user_id, role, profiles:user_id(full_name, email)")
        .eq("organization_id", orgId)
        .eq("status", "active");
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoadingCandidates(false);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: Candidate[] = (data as any[]).map((r) => ({
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? null,
        email: r.profiles?.email ?? null,
        role: r.role,
      }));
      setCandidates(rows);
      setLoadingCandidates(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  // Reset state when closing.
  useEffect(() => {
    if (open) return;
    setSelectedPrincipal(null);
    setSelectedDirectors(new Set());
    setTitle("");
    setSubmitting(false);
    setError(null);
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Principals = executive role. Directors = owner/admin/accountant.
  const principals = useMemo(
    () => candidates.filter((c) => c.role === "executive"),
    [candidates]
  );
  const directors = useMemo(
    () => candidates.filter((c) => c.role !== "executive"),
    [candidates]
  );

  const toggleDirector = (id: string) => {
    setSelectedDirectors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSubmit = !!selectedPrincipal && selectedDirectors.size >= 1 && !submitting;

  const handleCreate = useCallback(async () => {
    if (!canSubmit || !selectedPrincipal) return;
    setSubmitting(true);
    setError(null);

    // Build participants: principal + selected directors + the creator (if they're a director)
    const participants: { userId: string; role: "principal" | "director" }[] = [
      { userId: selectedPrincipal, role: "principal" },
      ...Array.from(selectedDirectors).map((id) => ({
        userId: id,
        role: "director" as const,
      })),
    ];
    // Ensure the creator is included (directors typically create, but
    // allow the edge case where they already ticked themselves).
    if (selfId && !participants.some((p) => p.userId === selfId)) {
      participants.push({ userId: selfId, role: "director" });
    }

    const result = await createThread({
      organizationId: orgId,
      title: title.trim() || null,
      participants,
    });
    setSubmitting(false);
    if (!result.success || !result.id) {
      setError(result.error || "Could not create conversation");
      return;
    }
    onClose();
    router.push(`${redirectBase}/${result.id}`);
  }, [canSubmit, selectedPrincipal, selectedDirectors, selfId, orgId, title, onClose, router, redirectBase]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  New conversation
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Pick one principal and the directors who should be in the conversation.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingCandidates ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Principal picker */}
                <section>
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Crown className="h-3.5 w-3.5" /> Principal
                  </label>
                  {principals.length === 0 ? (
                    <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[13px] text-muted-foreground">
                      No active principal found for this workspace.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {principals.map((p) => {
                        const active = selectedPrincipal === p.user_id;
                        return (
                          <button
                            key={p.user_id}
                            type="button"
                            onClick={() => setSelectedPrincipal(p.user_id)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                              active
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-background/50 hover:border-muted-foreground/40"
                            )}
                          >
                            <span className="text-[13px] font-medium">
                              {p.full_name || p.email || "Unknown"}
                            </span>
                            {p.email && (
                              <span className="text-[11px] text-muted-foreground">
                                {p.email}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Director picker */}
                <section>
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Directors
                  </label>
                  {directors.length === 0 ? (
                    <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[13px] text-muted-foreground">
                      No directors available.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {directors.map((d) => {
                        const active = selectedDirectors.has(d.user_id);
                        return (
                          <button
                            key={d.user_id}
                            type="button"
                            onClick={() => toggleDirector(d.user_id)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                              active
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/50 hover:border-muted-foreground/40"
                            )}
                          >
                            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                              <span
                                aria-hidden
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded border",
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border"
                                )}
                              >
                                {active && <span className="text-[10px]">✓</span>}
                              </span>
                              {d.full_name || d.email || "Unknown"}
                            </span>
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {d.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Optional title */}
                <section>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Property renovation"
                    maxLength={120}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </section>

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-300">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-border bg-transparent px-4 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!canSubmit}
                    className={cn(
                      "rounded-lg px-5 py-1.5 text-[13px] font-semibold transition-all",
                      canSubmit
                        ? "bg-primary text-primary-foreground hover:brightness-110"
                        : "border border-border bg-transparent text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {submitting ? "Creating…" : "Start conversation"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
