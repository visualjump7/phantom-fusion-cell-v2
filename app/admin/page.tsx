"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Users, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OverviewStats } from "@/components/admin/overview/OverviewStats";
import { ClientCard } from "@/components/admin/overview/ClientCard";
import { fetchAllClientsSummary, ClientSummary, deletePrincipal } from "@/lib/client-service";
import { useActivePrincipal } from "@/lib/use-active-principal";
import { DeletePrincipalModal } from "@/components/admin/shared/DeletePrincipalModal";
import { useRole } from "@/lib/use-role";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function CommandCenterPage() {
  const [summaries, setSummaries] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setActivePrincipal, activePrincipal, clearActivePrincipal } = useActivePrincipal();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<ClientSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { isAdmin, role, userId } = useRole();

  const loadSummaries = async () => {
    setIsLoading(true);
    const allSummaries = await fetchAllClientsSummary();

    if (isAdmin) {
      // Admins see all principals
      setSummaries(allSummaries);
    } else {
      // Manager/viewer: filter by principal_assignments
      const { data: assignments } = await db
        .from("principal_assignments")
        .select("organization_id")
        .eq("user_id", userId);

      const assignedOrgIds = (assignments || []).map((a: { organization_id: string }) => a.organization_id);
      setSummaries(allSummaries.filter((s) => assignedOrgIds.includes(s.orgId)));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (role !== null) loadSummaries();
  }, [role, userId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview across all principals. Select a workspace to manage.
        </p>
      </div>

      <OverviewStats summaries={summaries} />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Principals</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((summary) => (
            <ClientCard
              key={summary.orgId}
              summary={summary}
              onSelect={(s) => {
                setActivePrincipal({
                  orgId: s.orgId,
                  displayName: s.displayName,
                  accentColor: s.accentColor,
                });
                router.push(`/admin/client/${s.orgId}`);
              }}
              onDelete={isAdmin ? (s) => setDeleteTarget(s) : undefined}
            />
          ))}
          {summaries.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground">
              No principals onboarded yet. Use the sidebar to onboard a new principal.
            </p>
          )}
        </div>
      </div>

      {/* Admin-only: Team Management card */}
      {isAdmin && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Administration</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/admin/onboard-principal">
              <Card className="group cursor-pointer border-border transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-500/15 p-2">
                      <Users className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Onboard Principal</p>
                      <p className="text-xs text-muted-foreground">Guided wizard: org, principal, modules, holdings</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/users">
              <Card className="group cursor-pointer border-border transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Team Management</p>
                      <p className="text-xs text-muted-foreground">Invite users, manage roles and permissions</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeletePrincipalModal
          open={!!deleteTarget}
          orgId={deleteTarget.orgId}
          principalName={deleteTarget.displayName}
          onCancel={() => setDeleteTarget(null)}
          onConfirmDelete={async () => {
            const name = deleteTarget.displayName;
            const orgId = deleteTarget.orgId;
            const result = await deletePrincipal(orgId);
            if (result.success) {
              if (activePrincipal?.orgId === orgId) {
                clearActivePrincipal();
              }
              setDeleteTarget(null);
              setToast(`${name} has been permanently deleted`);
              loadSummaries();
              setTimeout(() => setToast(null), 4000);
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
          <p className="text-sm font-medium text-foreground">{toast}</p>
        </div>
      )}
    </div>
  );
}
