"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Calendar, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CashFlowData, formatFullCurrency, formatCompactCurrency } from "@/lib/cashflow";

interface CashFlowHeaderProps {
  data: CashFlowData;
}

export function CashFlowHeader({ data }: CashFlowHeaderProps) {
  const { todayEntry, dailyEntries, lastUpdated } = data;

  const balance = todayEntry?.endBalance ?? 0;
  const isNegative = balance < 0;

  const todayIdx = dailyEntries.findIndex((e) => e.date === todayEntry?.date);
  const yesterdayEntry = todayIdx > 0 ? dailyEntries[todayIdx - 1] : null;
  const delta = yesterdayEntry ? balance - yesterdayEntry.endBalance : 0;

  const nextEvent = dailyEntries.find(
    (e) => e.date > (todayEntry?.date ?? "") && e.transactions.length > 0
  );

  const updatedStr = new Date(lastUpdated).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/60 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[length:var(--font-size-caption)] text-muted-foreground mb-1">
              Current Cash Position
            </p>
            <p
              className="data-value text-[length:var(--font-size-page-title)] font-bold leading-tight"
              style={{ fontSize: "clamp(28px, 4vw, 42px)" }}
            >
              <span className={isNegative ? "text-red-500" : "text-emerald-500"}>
                {formatFullCurrency(balance)}
              </span>
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isNegative
                    ? "bg-red-500/10 text-red-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {isNegative ? "Cash Deficit" : "Available"}
              </span>
              {delta !== 0 && (
                <span className="flex items-center gap-1 text-[length:var(--font-size-caption)] text-muted-foreground">
                  {delta > 0 ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  )}
                  {formatCompactCurrency(Math.abs(delta))} from yesterday
                </span>
              )}
            </div>
          </div>
        </div>

        {isNegative && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-[length:var(--font-size-body)] text-amber-600 dark:text-amber-400">
              Balance is currently in deficit. Your Fusion Cell team has been notified.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-[length:var(--font-size-caption)] text-muted-foreground">In Today</span>
            </div>
            <p className={`data-value text-lg font-bold ${(todayEntry?.cashIn ?? 0) > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
              {formatFullCurrency(todayEntry?.cashIn ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-[length:var(--font-size-caption)] text-muted-foreground">Out Today</span>
            </div>
            <p className={`data-value text-lg font-bold ${(todayEntry?.cashOut ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {formatFullCurrency(todayEntry?.cashOut ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-[length:var(--font-size-caption)] text-muted-foreground">Next Event</span>
            </div>
            {nextEvent ? (
              <>
                <p className="text-[length:var(--font-size-body)] font-medium text-foreground truncate">
                  {nextEvent.transactions[0]?.label ?? "Balance change"}
                </p>
                <p className="text-[length:var(--font-size-caption)] text-muted-foreground">
                  {new Date(nextEvent.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" · "}
                  {formatCompactCurrency(
                    nextEvent.transactions[0]?.type === "out"
                      ? -nextEvent.transactions[0].amount
                      : nextEvent.transactions[0]?.amount ?? 0
                  )}
                </p>
              </>
            ) : (
              <p className="text-[length:var(--font-size-body)] text-muted-foreground italic">No upcoming events</p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-[length:var(--font-size-caption)] text-muted-foreground text-center">
        Prepared by your Fusion Cell team · Updated {updatedStr}
      </p>
    </div>
  );
}
