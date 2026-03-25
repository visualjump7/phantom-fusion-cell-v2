"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Receipt, MessageSquare, Upload, ChevronRight, Loader2, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientContext } from "@/lib/use-client-context";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { fetchBillSummary, BillSummary } from "@/lib/bill-service";
import { deletePrincipal } from "@/lib/client-service";
import { useActivePrincipal } from "@/lib/use-active-principal";
import { DeletePrincipalModal } from "@/components/admin/shared/DeletePrincipalModal";
import { useRole } from "@/lib/use-role";
import { hasPermission } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function WorkspaceDashboard() {
  const { orgId, clientName } = useClientContext();
  const { activePrincipal, clearActivePrincipal } = useActivePrincipal();
  const { role, isAdmin } = useRole();
  const canUpload = hasPermission(role, "uploadBudgets");
  const canDelete = hasPermission(role, "deletePrincipal");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [holdingsCount, setHoldingsCount] = useState(0);
  const [holdingsValue, setHoldingsValue] = useState(0);
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const [assetsRes, billsRes, messagesRes] = await Promise.all([
        db.from("assets").select("id, estimated_value").eq("organization_id", orgId).eq("is_deleted", false),
        fetchBillSummary(orgId),
        db.from("messages").select("id").eq("organization_id", orgId).eq("is_deleted", false).eq("is_archived", false),
      ]);

      const assets = assetsRes.data || [];
      setHoldingsCount(assets.length);
      setHoldingsValue(assets.reduce((sum: number, a: { estimated_value: number }) => sum + (a.estimated_value || 0), 0));
      setBillSummary(billsRes);
      setAlertsCount((messagesRes.data || []).length);
      setIsLoading(false);
    }
    loadData();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const quickLinks = [
    { name: "Holdings", href: `/admin/client/${orgId}/holdings`, icon: Building2, stat: `${holdingsCount} holdings` },
    { name: "Bills", href: `/admin/client/${orgId}/bills`, icon: Receipt, stat: `${billSummary?.upcomingCount || 0} pending` },
    { name: "Alerts", href: `/admin/client/${orgId}/messages`, icon: MessageSquare, stat: `${alertsCount} active` },
    ...(canUpload ? [{ name: "Budget Upload", href: `/admin/client/${orgId}/upload`, icon: Upload, stat: "Import budgets" }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{clientName}&apos;s Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage holdings, bills, alerts, and budgets for this principal.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{holdingsCount}</p>
            <p className="text-xs text-muted-foreground">Holdings</p>
            {holdingsValue > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(holdingsValue)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{billSummary?.upcomingCount || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Bills</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency((billSummary?.totalDueThisMonth || 0) / 100)} this month
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{billSummary?.overdueCount || 0}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency((billSummary?.overdueTotal || 0) / 100)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{alertsCount}</p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <Card className="group cursor-pointer border-border transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <link.icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{link.name}</p>
                      <p className="text-xs text-muted-foreground">{link.stat}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Danger Zone — admin only */}
      {canDelete && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete this principal and all associated data. This cannot be undone.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => setShowDeleteModal(true)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete Principal
        </Button>
      </div>}

      {canDelete && <DeletePrincipalModal
        open={showDeleteModal}
        orgId={orgId}
        principalName={clientName}
        onCancel={() => setShowDeleteModal(false)}
        onConfirmDelete={async () => {
          const result = await deletePrincipal(orgId);
          if (result.success) {
            if (activePrincipal?.orgId === orgId) {
              clearActivePrincipal();
            }
            setShowDeleteModal(false);
            setDeleteToast(`${clientName} has been permanently deleted`);
            setTimeout(() => router.push("/admin"), 1500);
          }
        }}
      />}

      {deleteToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
          <p className="text-sm font-medium text-foreground">{deleteToast}</p>
        </div>
      )}
    </div>
  );
}
