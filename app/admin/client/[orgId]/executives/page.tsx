"use client";

/**
 * Executives — the humans who can log in to a principal account.
 *
 * The principal account is the org. Executives are organization_members with
 * role = 'executive'. Each executive has independent per-person view config
 * (which modules / summary cards appear when they log in) — managed on
 * /admin/client/[orgId]/principal-experience, deep-linked from the
 * "Configure view" button on each row here.
 *
 * v1: list, add, remove. Edit (rename / change phone) lives on the profile
 * itself and isn't urgent — defer.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  UserPlus,
  Trash2,
  Settings,
  Mail,
  Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientContext } from "@/lib/use-client-context";
import { useRole } from "@/lib/use-role";
import { useActionGuard } from "@/lib/use-action-guard";
import {
  fetchExecutives,
  removeExecutive,
  type Executive,
} from "@/lib/executives-service";
import { AddExecutiveModal } from "@/components/admin/shared/AddExecutiveModal";

export default function ExecutivesPage() {
  const router = useRouter();
  const { orgId, clientName } = useClientContext();
  const { isAdmin } = useRole();
  const { blocked, guardClick } = useActionGuard();

  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Executive | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadExecutives() {
    setLoading(true);
    const rows = await fetchExecutives(orgId);
    setExecutives(rows);
    setLoading(false);
  }

  useEffect(() => {
    loadExecutives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function handleAdded(userId: string) {
    setShowAdd(false);
    loadExecutives();
    // Drop straight into their view-config page so the admin can immediately
    // pick the modules they should see. The principal-experience page reads
    // ?principalId= to preselect.
    router.push(
      `/admin/client/${orgId}/principal-experience?principalId=${userId}`
    );
  }

  async function handleRemove(exec: Executive) {
    setRemoving(true);
    setError(null);
    const res = await removeExecutive(exec.userId, orgId);
    setRemoving(false);
    if (!res.success) {
      setError(res.error || "Couldn't remove executive.");
      return;
    }
    setConfirmRemove(null);
    setExecutives((prev) => prev.filter((e) => e.userId !== exec.userId));
  }

  function configureView(userId: string) {
    router.push(
      `/admin/client/${orgId}/principal-experience?principalId=${userId}`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executives</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People who can sign in to <strong>{clientName}</strong>. Each one has their own
            view — configure what they see when they log in.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAdd(true)} disabled={blocked} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Add executive
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : executives.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/10">
          <CardContent className="p-8 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No executives yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the first executive on this principal account so they can sign in.
            </p>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setShowAdd(true)}
                disabled={blocked}
                className="mt-4 gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add executive
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {executives.map((exec) => (
            <Card key={exec.userId} className="border-border bg-card/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {exec.fullName}
                    </p>
                    {exec.status !== "active" && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                        {exec.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {exec.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {exec.email}
                      </span>
                    )}
                    {exec.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {exec.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => configureView(exec.userId)}
                    className="gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configure view
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={guardClick(() => setConfirmRemove(exec))}
                      disabled={blocked}
                      aria-label={`Remove ${exec.fullName}`}
                      className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddExecutiveModal
        open={showAdd}
        orgId={orgId}
        principalName={clientName}
        onClose={() => setShowAdd(false)}
        onAdded={handleAdded}
      />

      {/* Remove confirmation */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">
              Remove {confirmRemove.fullName}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              They&apos;ll lose access to {clientName} and their view config will be
              cleared. Their account isn&apos;t deleted — they can be re-added later.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmRemove(null)}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleRemove(confirmRemove)}
                disabled={removing}
                className="gap-1.5 bg-red-500/90 text-white hover:bg-red-500"
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
