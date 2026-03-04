"use client";

import { useState, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DailyEntry, formatFullCurrency, formatCompactCurrency } from "@/lib/cashflow";

interface TransactionFeedProps {
  entries: DailyEntry[];
}

type TypeFilter = "all" | "in" | "out";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TransactionFeed({ entries }: TransactionFeedProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const daysWithTransactions = useMemo(() => {
    let days = entries.filter((e) => e.cashIn > 0 || e.cashOut > 0);

    if (typeFilter === "in") {
      days = days.filter((e) => e.transactions.some((t) => t.type === "in"));
    } else if (typeFilter === "out") {
      days = days.filter((e) => e.transactions.some((t) => t.type === "out"));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      days = days.filter((e) =>
        e.transactions.some((t) => t.label.toLowerCase().includes(q))
      );
    }

    return days;
  }, [entries, typeFilter, searchQuery]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, DailyEntry[]> = {};
    daysWithTransactions.forEach((e) => {
      const key = e.date.substring(0, 7);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [daysWithTransactions]);

  const filters: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "in", label: "Cash In" },
    { value: "out", label: "Cash Out" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[length:var(--font-size-body)] font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="pl-9"
          />
        </div>
      </div>

      {groupedByMonth.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No transactions found for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByMonth.map(([monthKey, days]) => {
            const [year, month] = monthKey.split("-").map(Number);
            return (
              <div key={monthKey}>
                <div className="sticky top-0 z-10 mb-3 border-b border-border bg-background pb-2 pt-1">
                  <h3 className="text-[length:var(--font-size-body)] font-semibold text-foreground">
                    {MONTH_NAMES[month - 1]} {year}
                  </h3>
                </div>
                <div className="space-y-2">
                  {days.map((day) => {
                    const visibleTx = typeFilter === "all"
                      ? day.transactions
                      : day.transactions.filter((t) => t.type === typeFilter);
                    const filteredTx = searchQuery.trim()
                      ? visibleTx.filter((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
                      : visibleTx;

                    return (
                      <div
                        key={day.date}
                        className="rounded-xl border border-border bg-card/60 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric",
                            })}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                              day.endBalance >= 0
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-red-500/10 text-red-500"
                            }`}
                          >
                            {formatCompactCurrency(day.endBalance)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {filteredTx.map((t, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                {t.type === "in"
                                  ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                                  : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                                <span className="text-sm text-foreground">{t.label}</span>
                              </div>
                              <span className={`text-sm font-semibold ${t.type === "in" ? "text-emerald-500" : "text-red-500"}`}>
                                {t.type === "out" ? "-" : "+"}{formatFullCurrency(t.amount)}
                              </span>
                            </div>
                          ))}
                          {filteredTx.length === 0 && (
                            <p className="text-xs text-muted-foreground italic px-2">Balance carried forward</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
