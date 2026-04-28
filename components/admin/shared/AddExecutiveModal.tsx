"use client";

/**
 * AddExecutiveModal — small form modal for attaching a new executive to an
 * existing principal account. Posts through addExecutive() which hits the
 * server route. On success, calls onAdded(userId) so the caller can route to
 * the new executive's view-config page if desired.
 */

import { useState } from "react";
import { Loader2, X as XIcon, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addExecutive } from "@/lib/executives-service";

export function AddExecutiveModal({
  open,
  orgId,
  principalName,
  onClose,
  onAdded,
}: {
  open: boolean;
  orgId: string;
  principalName: string;
  onClose: () => void;
  onAdded: (userId: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await addExecutive(orgId, {
      fullName,
      email,
      phone: phone || undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const newId = res.userId;
    reset();
    onAdded(newId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-executive-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 id="add-executive-title" className="text-base font-semibold text-foreground">
              Add executive
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <p className="text-xs text-muted-foreground">
            Adding a new executive to <strong>{principalName}</strong>. They&apos;ll get a sign-in
            email and you can configure what they see next.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Full name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !fullName.trim() || !/@/.test(email)}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Add executive
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
