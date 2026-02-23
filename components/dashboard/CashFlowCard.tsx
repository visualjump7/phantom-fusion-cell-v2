"use client";

import { motion } from "framer-motion";
import {
  TrendingDown,
  TrendingUp,
  Calendar,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillSummary, Bill } from "@/lib/bill-service";
import { formatCentsToDisplay } from "@/lib/bill-parser";

interface CashFlowCardProps {
  summary: BillSummary | null;
  upcomingBills: Bill[];
}

export function CashFlowCard({ summary, upcomingBills }: CashFlowCardProps) {
  if (!summary) return null;

  return (
    <Card className="border-border bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-amber-400" />
            Cash Flow
          </CardTitle>
          <Link
            href="/calendar"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Calendar
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monthly due */}
        <div>
          <p className="text-xs text-muted-foreground">Due this month</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCentsToDisplay(summary.totalDueThisMonth)}
          </p>
          {summary.paidThisMonth > 0 && (
            <p className="mt-0.5 text-xs text-emerald-400">
              {formatCentsToDisplay(summary.paidThisMonth)} paid
            </p>
          )}
        </div>

        {/* Overdue warning */}
        {summary.overdueCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-300">
              {summary.overdueCount} overdue bill{summary.overdueCount !== 1 ? "s" : ""}{" "}
              ({formatCentsToDisplay(summary.overdueTotal)})
            </span>
          </div>
        )}

        {/* Next 7 days */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Next 7 days
            </p>
            <Badge variant="outline" className="text-xs">
              {summary.upcoming7DaysCount} bill{summary.upcoming7DaysCount !== 1 ? "s" : ""}
            </Badge>
          </div>

          {summary.upcoming7DaysTotal > 0 && (
            <p className="mb-3 text-lg font-semibold text-foreground">
              {formatCentsToDisplay(summary.upcoming7DaysTotal)}
            </p>
          )}

          {/* Upcoming bill list */}
          {upcomingBills.length > 0 && (
            <div className="space-y-1.5">
              {upcomingBills.slice(0, 4).map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-lg bg-background/30 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {bill.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(bill.due_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {bill.asset_name && ` · ${bill.asset_name}`}
                    </p>
                  </div>
                  <p className="ml-2 text-xs font-semibold text-foreground">
                    {formatCentsToDisplay(bill.amount_cents)}
                  </p>
                </div>
              ))}

              {upcomingBills.length > 4 && (
                <Link
                  href="/calendar"
                  className="block pt-1 text-center text-xs text-primary hover:underline"
                >
                  +{upcomingBills.length - 4} more →
                </Link>
              )}
            </div>
          )}

          {upcomingBills.length === 0 && summary.upcoming7DaysCount === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No bills in the next 7 days
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
