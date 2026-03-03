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
            className="flex items-center gap-1 text-[length:var(--font-size-caption)] text-primary hover:underline"
          >
            Calendar
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monthly due */}
        <div>
          <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Due this month</p>
          <p className="data-value text-[length:var(--font-size-section-header)] font-bold text-foreground">
            {formatCentsToDisplay(summary.totalDueThisMonth)}
          </p>
          {summary.paidThisMonth > 0 && (
            <p className="mt-0.5 text-[length:var(--font-size-caption)]" style={{ color: "var(--color-success)" }}>
              {formatCentsToDisplay(summary.paidThisMonth)} paid
            </p>
          )}
        </div>

        {/* Overdue warning */}
        {summary.overdueCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "color-mix(in srgb, var(--color-danger) 40%, transparent)", background: "color-mix(in srgb, var(--color-danger) 12%, transparent)" }}>
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
            <span className="text-[length:var(--font-size-caption)]" style={{ color: "var(--color-danger)" }}>
              {summary.overdueCount} overdue bill{summary.overdueCount !== 1 ? "s" : ""}{" "}
              ({formatCentsToDisplay(summary.overdueTotal)})
            </span>
          </div>
        )}

        {/* Next 7 days */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[length:var(--font-size-caption)] font-medium text-muted-foreground">
              Next 7 days
            </p>
            <Badge variant="outline">
              {summary.upcoming7DaysCount} bill{summary.upcoming7DaysCount !== 1 ? "s" : ""}
            </Badge>
          </div>

          {summary.upcoming7DaysTotal > 0 && (
            <p className="data-value mb-3 text-[length:var(--font-size-section-header)] font-semibold text-foreground">
              {formatCentsToDisplay(summary.upcoming7DaysTotal)}
            </p>
          )}

          {/* Upcoming bill list */}
          {upcomingBills.length > 0 && (
            <div className="space-y-1.5">
              {upcomingBills.slice(0, 4).map((bill) => (
                <div
                  key={bill.id}
                  className="flex min-h-[var(--table-row-height)] items-center justify-between rounded-lg bg-background/30 px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[length:var(--font-size-body)] font-medium text-foreground">
                      {bill.title}
                    </p>
                    <p className="text-[length:var(--font-size-caption)] text-muted-foreground">
                      {new Date(bill.due_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {bill.asset_name && ` · ${bill.asset_name}`}
                    </p>
                  </div>
                  <p className="data-value ml-2 font-semibold text-foreground">
                    {formatCentsToDisplay(bill.amount_cents)}
                  </p>
                </div>
              ))}

              {upcomingBills.length > 4 && (
                <Link
                  href="/calendar"
                  className="block pt-1 text-center text-[length:var(--font-size-caption)] text-primary hover:underline"
                >
                  +{upcomingBills.length - 4} more →
                </Link>
              )}
            </div>
          )}

          {upcomingBills.length === 0 && summary.upcoming7DaysCount === 0 && (
            <p className="text-[length:var(--font-size-caption)] text-muted-foreground italic">
              No bills in the next 7 days
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
