"use client";

import { Building2, Users, Receipt, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ClientSummary } from "@/lib/client-service";

interface OverviewStatsProps {
  summaries: ClientSummary[];
}

export function OverviewStats({ summaries }: OverviewStatsProps) {
  const totalClients = summaries.length;
  const totalProjects = summaries.reduce((sum, s) => sum + s.projectsCount, 0);
  const totalProjectsValue = summaries.reduce((sum, s) => sum + s.projectsValue, 0);
  const totalPendingBills = summaries.reduce((sum, s) => sum + s.pendingBillsCount, 0);
  const totalPendingAmount = summaries.reduce((sum, s) => sum + s.pendingBillsTotal, 0);
  const totalAlerts = summaries.reduce((sum, s) => sum + s.unresolvedAlertsCount, 0);

  const stats = [
    {
      label: "Principals",
      value: totalClients,
      subtext: `${summaries.filter((s) => s.status === "active").length} active`,
      icon: Users,
    },
    {
      label: "Total Projects",
      value: totalProjects,
      subtext: formatCurrency(totalProjectsValue),
      icon: Building2,
    },
    {
      label: "Pending Bills",
      value: totalPendingBills,
      subtext: formatCurrency(totalPendingAmount / 100),
      icon: Receipt,
    },
    {
      label: "Active Alerts",
      value: totalAlerts,
      subtext: "Across all principals",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{stat.subtext}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
