"use client";

/**
 * AddExecutiveGlobalModal — used by the global Executive Team page.
 *
 * Richer than the per-account AddExecutiveModal: lets the admin pick which
 * principal accounts the new executive can sign in to (multi-select), and
 * optionally set a password directly so they can use email + password
 * immediately instead of a magic-link confirmation.
 */

import { useEffect, useState } from "react";
import { Loader2, X as XIcon, UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addExecutiveGlobal } from "@/lib/executives-service";
import { fetchClientProfiles, type ClientProfile } from "@/lib/client-service";

export function AddExecutiveGlobalModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (userId: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [orgIds, setOrgIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<ClientProfile[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingAccounts(true);
    fetchClientProfiles().then((rows) => {
      const active = (rows as ClientProfile[]).filter(
        (r) => r.status === "active" || r.status === "onboarding"
      );
      setAccounts(active);
      setLoadingAccounts(false);
    });
  }, [open]);

  if (!open) return null;

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setOrgIds([]);
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function toggleOrg(orgId: string) {
    setOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (orgIds.length === 0) {
      setError("Pick at least one principal account.");
      return;
    }
    setSubmitting(true);
    const res = await addExecutiveGlobal({
      fullName,
      email,
      phone: phone || undefined,
      password: password || undefined,
      orgIds,
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

  const valid = fullName.trim() && /@/.test(email) && orgIds.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-exec-global-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 id="add-exec-global-title" className="text-base font-semibold text-foreground">
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Password <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to send a sign-in email instead"
              disabled={submitting}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              If set, the executive can sign in immediately with email + password.
              Otherwise they get a magic-link email and set their own.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Principal accounts <span className="text-red-400">*</span>
            </label>
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                No principal accounts exist yet. Onboard one first.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-muted/10 p-2">
                {accounts.map((a) => {
                  const checked = orgIds.includes(a.organization_id);
                  return (
                    <label
                      key={a.organization_id}
                      className={
                        "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition " +
                        (checked
                          ? "border-primary/40 bg-primary/5 text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/40")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrg(a.organization_id)}
                        disabled={submitting}
                        className="h-3.5 w-3.5"
                      />
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{a.display_name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !valid} className="gap-1.5">
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
