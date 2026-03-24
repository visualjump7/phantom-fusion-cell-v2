"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2, Receipt, MessageSquare, Upload, ChevronRight, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useClientContext } from "@/lib/use-client-context";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { fetchBillSummary, BillSummary } from "@/lib/bill-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function WorkspaceDashboard() {
  const { orgId, clientName } = useClientContext();
  const [isLoading, setIsLoading] = useState(true);
  const [holdingsCount, setHoldingsCount] = useState(0);
  const [holdingsValue, setHoldingsValue] = useState(0);
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [alertsCount, setAlertsCount] = useState(0);

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
    { name: "Budget Upload", href: `/admin/client/${orgId}/upload`, icon: Upload, stat: "Import budgets" },
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
    </div>
  );
}
