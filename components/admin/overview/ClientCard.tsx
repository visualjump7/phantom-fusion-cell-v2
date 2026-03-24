"use client";

import Link from "next/link";
import { Building2, Receipt, MessageSquare, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ClientSummary } from "@/lib/client-service";

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  coral: "bg-orange-500",
  pink: "bg-pink-500",
  green: "bg-emerald-500",
};

const ACCENT_BORDER: Record<string, string> = {
  amber: "hover:border-amber-500/40",
  blue: "hover:border-blue-500/40",
  teal: "hover:border-teal-500/40",
  purple: "hover:border-purple-500/40",
  coral: "hover:border-orange-500/40",
  pink: "hover:border-pink-500/40",
  green: "hover:border-emerald-500/40",
};

interface ClientCardProps {
  summary: ClientSummary;
}

export function ClientCard({ summary }: ClientCardProps) {
  const dotClass = ACCENT_DOT[summary.accentColor] || ACCENT_DOT.amber;
  const borderClass = ACCENT_BORDER[summary.accentColor] || ACCENT_BORDER.amber;

  return (
    <Link href={`/admin/client/${summary.orgId}`}>
      <Card className={`group cursor-pointer border-border transition-all ${borderClass} hover:bg-muted/30`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${dotClass}`} />
              <h3 className="text-base font-semibold text-foreground">{summary.displayName}</h3>
              {summary.status !== "active" && (
                <Badge variant="outline" className="text-xs">{summary.status}</Badge>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold text-foreground">{summary.holdingsCount}</p>
                <p className="text-xs text-muted-foreground">Holdings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold text-foreground">{summary.pendingBillsCount}</p>
                <p className="text-xs text-muted-foreground">Pending bills</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold text-foreground">{summary.unresolvedAlertsCount}</p>
                <p className="text-xs text-muted-foreground">Alerts</p>
              </div>
            </div>
          </div>

          {summary.holdingsValue > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Total holdings value: {formatCurrency(summary.holdingsValue)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
