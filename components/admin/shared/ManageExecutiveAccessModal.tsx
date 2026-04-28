"use client";

/**
 * ManageExecutiveAccessModal — multi-select of principal accounts the
 * executive can sign in to. Diffs the desired set against current and adds /
 * removes accordingly. Removing from an account also wipes that account's
 * per-person view config for this executive (handled in the service).
 */

import { useEffect, useState } from "react";
import { Loader2, X as XIcon, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setExecutiveAccountAccess } from "@/lib/executives-service";
import { fetchClientProfiles, type ClientProfile } from "@/lib/client-service";

export function ManageExecutiveAccessModal({
  open,
  onClose,
  onSaved,
  executive,
  initialOrgIds,
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
  initialOrgIds: string[];
}) {
  const [accounts, setAccounts] = useState<ClientProfile[]>([]);
  const [selected, setSelected] = useState<string[]>(initialOrgIds);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(initialOrgIds);
    setError(null);
    setLoading(true);
    fetchClientProfiles().then((rows) => {
      const active = (rows as ClientProfile[]).filter(
        (r) => r.status === "active" || r.status === "onboarding"
      );
      setAccounts(active);
      setLoading(false);
    });
  }, [open, initialOrgIds]);

  if (!open) return null;

  function toggle(orgId: string) {
    setSelected((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await setExecutiveAccountAccess(executive.userId, selected, {
      fullName: executive.fullName,
      email: executive.email,
      phone: executive.phone || undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || "Couldn't update access.");
      return;
    }
    onSaved();
    onClose();
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Account access — {executive.fullName}
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
            Choose every principal account this executive can sign in to. Removing them
            from an account also clears their per-account view config for that account.
          </p>

          {loading ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              No principal accounts exist yet.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-muted/10 p-2">
              {accounts.map((a) => {
                const checked = selected.includes(a.organization_id);
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
                      onChange={() => toggle(a.organization_id)}
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

          {error && (
            <div className="rounded-md border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save access
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
