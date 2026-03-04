"use client";

import { useMemo, useState, Fragment } from "react";
import { ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DailyEntry, formatFullCurrency } from "@/lib/cashflow";

interface MonthlyTableProps {
  entries: DailyEntry[];
}

interface MonthSummary {
  key: string;
  label: string;
  totalCashIn: number;
  totalCashOut: number;
  netChange: number;
  endBalance: number;
  startBalance: number;
  transactions: { date: string; label: string; amount: number; type: "in" | "out" }[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthlyTable({ entries }: MonthlyTableProps) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const months = useMemo(() => {
    const grouped: Record<string, DailyEntry[]> = {};
    entries.forEach((e) => {
      const key = e.date.substring(0, 7);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });

    const result: MonthSummary[] = [];
    for (const [key, dayEntries] of Object.entries(grouped)) {
      const [year, month] = key.split("-").map(Number);
      const totalCashIn = dayEntries.reduce((s, e) => s + e.cashIn, 0);
      const totalCashOut = dayEntries.reduce((s, e) => s + e.cashOut, 0);
      const sorted = [...dayEntries].sort((a, b) => a.date.localeCompare(b.date));
      const startBalance = sorted[0]?.begBalance ?? 0;
      const endBalance = sorted[sorted.length - 1]?.endBalance ?? 0;

      const transactions: MonthSummary["transactions"] = [];
      sorted.forEach((day) => {
        day.transactions.forEach((t) => {
          transactions.push({ date: day.date, label: t.label, amount: t.amount, type: t.type });
        });
      });

      result.push({
        key,
        label: `${MONTH_NAMES[month - 1]} ${year}`,
        totalCashIn,
        totalCashOut,
        netChange: totalCashIn - totalCashOut,
        endBalance,
        startBalance,
        transactions,
      });
    }

    return result.sort((a, b) => a.key.localeCompare(b.key));
  }, [entries]);

  const currentMonthKey = new Date().toISOString().substring(0, 7);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Month</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Cash In</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Cash Out</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Net Change</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">End Balance</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month, idx) => {
            const isCurrent = month.key === currentMonthKey;
            const isExpanded = expandedMonth === month.key;

            return (
              <Fragment key={month.key}>
                <tr
                  onClick={() => setExpandedMonth(isExpanded ? null : month.key)}
                  className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                    isCurrent ? "border-l-2 border-l-primary" : ""
                  } ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      {month.label}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-500">
                    {month.totalCashIn > 0 ? formatFullCurrency(month.totalCashIn) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-500">
                    {month.totalCashOut > 0 ? formatFullCurrency(month.totalCashOut) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${month.netChange >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatFullCurrency(month.netChange)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                      month.endBalance >= 0
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-red-500/10 text-red-500"
                    }`}>
                      {formatFullCurrency(month.endBalance)}
                    </span>
                  </td>
                </tr>

                {isExpanded && month.transactions.length > 0 && (
                  <tr>
                    <td colSpan={5} className="bg-muted/20 px-4 py-3">
                      <div className="grid gap-1 sm:grid-cols-2">
                        {month.transactions.map((t, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              {t.type === "in"
                                ? <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                              <span className="text-muted-foreground">
                                {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              <span className="text-foreground">{t.label}</span>
                            </div>
                            <span className={`font-medium ${t.type === "in" ? "text-emerald-500" : "text-red-500"}`}>
                              {t.type === "out" ? "-" : "+"}{formatFullCurrency(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
