"use client";

/**
 * Executive Team — global roster of every executive across every principal
 * account. Admin-only. From here:
 *   - Add a new executive and pick which principal accounts they can sign in to
 *   - Edit name / email / phone (email change updates auth.users)
 *   - Set a password manually (reuses SetPasswordModal)
 *   - Manage which principal accounts they can sign in to
 *   - Remove from all accounts
 *
 * Per-account add/remove still lives at /admin/client/[orgId]/executives — this
 * page is the bird's-eye view for managing executives globally.
 */

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  UserPlus,
  Pencil,
  KeyRound,
  Building2,
  Trash2,
  MoreVertical,
  Mail,
  Phone,
  UserCog,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/use-role";
import {
  fetchAllExecutives,
  removeExecutive,
  type ExecutiveRoster,
} from "@/lib/executives-service";
import { AddExecutiveGlobalModal } from "@/components/admin/shared/AddExecutiveGlobalModal";
import { EditExecutiveModal } from "@/components/admin/shared/EditExecutiveModal";
import { ManageExecutiveAccessModal } from "@/components/admin/shared/ManageExecutiveAccessModal";
import { SetPasswordModal } from "@/components/admin/shared/SetPasswordModal";

export default function ExecutiveTeamPage() {
  const { isAdmin } = useRole();
  const [executives, setExecutives] = useState<ExecutiveRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<ExecutiveRoster | null>(null);
  const [accessTarget, setAccessTarget] = useState<ExecutiveRoster | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<ExecutiveRoster | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ExecutiveRoster | null>(null);
  const [removing, setRemoving] = useState(false);

  // Action menu (per-row)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  async function loadExecutives() {
    setLoading(true);
    const rows = await fetchAllExecutives();
    setExecutives(rows);
    setLoading(false);
  }

  useEffect(() => {
    loadExecutives();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleRemoveAll(exec: ExecutiveRoster) {
    setRemoving(true);
    let lastErr: string | null = null;
    for (const acc of exec.accounts) {
      const res = await removeExecutive(exec.userId, acc.orgId);
      if (!res.success) {
        lastErr = res.error || "Couldn't remove from one account.";
      }
    }
    setRemoving(false);
    setRemoveTarget(null);
    if (lastErr) {
      showToast(`Removed with errors: ${lastErr}`);
    } else {
      showToast(`${exec.fullName} removed from all accounts`);
    }
    loadExecutives();
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Executive Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every executive across every principal account.{" "}
            {executives.length} {executives.length === 1 ? "person" : "people"}.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add executive
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : executives.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/10">
          <CardContent className="p-10 text-center">
            <UserCog className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No executives yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the first executive and pick which principal accounts they can sign in to.
            </p>
            <Button size="sm" onClick={() => setShowAdd(true)} className="mt-4 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Add executive
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {executives.map((exec) => {
            const initials = (exec.fullName || exec.email || "??")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <Card key={exec.userId} className="border-border">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-300">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">
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
                    {exec.accounts.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {exec.accounts.map((a) => (
                          <span
                            key={a.orgId}
                            className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            <Building2 className="h-2.5 w-2.5" />
                            {a.displayName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-amber-400">
                        No accounts — they can&apos;t sign in until you grant access.
                      </p>
                    )}
                  </div>

                  {/* Action menu */}
                  <div
                    className="relative"
                    ref={menuOpenId === exec.userId ? menuRef : undefined}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === exec.userId ? null : exec.userId);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Actions for ${exec.fullName}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {menuOpenId === exec.userId && (
                      <div className="absolute right-0 top-full z-10 mt-1 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-lg">
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setEditTarget(exec);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit name / email / phone
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setAccessTarget(exec);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <Building2 className="h-3.5 w-3.5" /> Manage account access
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setPasswordTarget(exec);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Set password
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setRemoveTarget(exec);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove from all accounts
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddExecutiveGlobalModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => {
          setShowAdd(false);
          loadExecutives();
          showToast("Executive added");
        }}
      />

      {editTarget && (
        <EditExecutiveModal
          open={!!editTarget}
          executive={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            loadExecutives();
            showToast("Profile updated");
          }}
        />
      )}

      {accessTarget && (
        <ManageExecutiveAccessModal
          open={!!accessTarget}
          executive={accessTarget}
          initialOrgIds={accessTarget.accounts.map((a) => a.orgId)}
          onClose={() => setAccessTarget(null)}
          onSaved={() => {
            setAccessTarget(null);
            loadExecutives();
            showToast("Account access updated");
          }}
        />
      )}

      {passwordTarget && (
        <SetPasswordModal
          open={!!passwordTarget}
          userId={passwordTarget.userId}
          userName={passwordTarget.fullName}
          onClose={() => setPasswordTarget(null)}
          onSuccess={() => {
            setPasswordTarget(null);
            showToast("Password updated");
          }}
        />
      )}

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">
              Remove {removeTarget.fullName}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              They&apos;ll lose access to {removeTarget.accounts.length}{" "}
              {removeTarget.accounts.length === 1 ? "account" : "accounts"} and their
              per-account view config will be cleared. Their sign-in account stays —
              they can be re-added later.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleRemoveAll(removeTarget)}
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
          <p className="text-sm font-medium text-foreground">{toast}</p>
        </div>
      )}
    </div>
  );
}
