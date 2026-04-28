"use client";

/**
 * EditExecutiveModal — edit name / email / phone for an existing executive.
 * Email change goes through the server route (auth.users + profiles); name
 * and phone are profile-only updates.
 */

import { useState } from "react";
import { Loader2, X as XIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateExecutiveProfile } from "@/lib/executives-service";

export function EditExecutiveModal({
  open,
  onClose,
  onSaved,
  executive,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  executive: {
    userId: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
}) {
  const [fullName, setFullName] = useState(executive.fullName);
  const [email, setEmail] = useState(executive.email);
  const [phone, setPhone] = useState(executive.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleClose() {
    if (submitting) return;
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Build a sparse patch — only send fields that actually changed so we
    // don't trigger unnecessary auth.users writes.
    const patch: { fullName?: string; email?: string; phone?: string | null } = {};
    if (fullName.trim() !== executive.fullName) patch.fullName = fullName.trim();
    if (email.trim() !== executive.email) patch.email = email.trim();
    const phoneNorm = phone.trim();
    const currentPhone = executive.phone ?? "";
    if (phoneNorm !== currentPhone) patch.phone = phoneNorm || null;

    if (Object.keys(patch).length === 0) {
      onSaved();
      onClose();
      return;
    }

    setSubmitting(true);
    const res = await updateExecutiveProfile(executive.userId, patch);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || "Couldn't save changes.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Edit executive</h2>
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
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Full name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
              disabled={submitting}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Updating the email also updates the sign-in address — they&apos;ll use
              the new one to log in.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !fullName.trim() || !/@/.test(email)}
              className="gap-1.5"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
