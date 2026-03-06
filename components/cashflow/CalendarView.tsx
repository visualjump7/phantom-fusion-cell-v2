"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, X, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashFlowData, DailyEntry, formatCompactCurrency, formatFullCurrency } from "@/lib/cashflow";

interface CalendarViewProps {
  cashFlowData: CashFlowData;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView({ cashFlowData }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const entryMap = useMemo(() => {
    const map: Record<string, DailyEntry> = {};
    cashFlowData.dailyEntries.forEach((e) => { map[e.date] = e; });
    return map;
  }, [cashFlowData.dailyEntries]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const endPadding = 6 - lastDay.getDay();
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  const formatDateKey = (date: Date): string => date.toISOString().split("T")[0];
  const isToday = (date: Date): boolean => date.toDateString() === new Date().toDateString();

  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const selectedEntry = selectedDate ? entryMap[selectedDate] : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="min-w-[200px] text-center text-lg font-semibold text-foreground">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="ml-2">
            Today
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card/60">
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="px-2 py-3 text-center text-[length:var(--cal-header-size)] font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dateKey = formatDateKey(date);
            const entry = entryMap[dateKey];
            const today = isToday(date);
            const billCount = entry ? entry.transactions.filter(t => t.type === "out").length : 0;

            return (
              <button
                key={index}
                onClick={() => entry && setSelectedDate(dateKey)}
                disabled={!entry}
                style={{ minHeight: "var(--cal-cell-min-h)" }}
                className={`
                  relative flex flex-col border-b border-r border-border/50 p-[--cal-cell-padding] text-left transition-colors
                  ${!isCurrentMonth ? "opacity-30" : ""}
                  ${entry ? "cursor-pointer hover:bg-muted/30" : "cursor-default"}
                  ${selectedDate === dateKey ? "ring-2 ring-inset ring-primary" : ""}
                `}
              >
                <div
                  className={`
                    mb-1 text-[length:var(--cal-date-size)] font-medium
                    ${!isCurrentMonth ? "text-muted-foreground/50" : "text-muted-foreground"}
                    ${today ? "flex items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}
                  `}
                  style={today ? { width: "var(--cal-today-size)", height: "var(--cal-today-size)" } : undefined}
                >
                  {date.getDate()}
                </div>

                {entry && isCurrentMonth && (
                  <div className="mt-auto flex flex-col gap-[--cal-cell-gap]">
                    <div
                      className={`text-[length:var(--cal-balance-size)] font-bold ${
                        entry.endBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatCompactCurrency(entry.endBalance)}
                    </div>
                    {entry.cashIn > 0 && (
                      <div className="text-[length:var(--cal-detail-size)] font-medium text-emerald-600 dark:text-emerald-400">
                        +{formatCompactCurrency(entry.cashIn)} in
                      </div>
                    )}
                    {billCount > 0 && (
                      <div className="text-[length:var(--cal-detail-size)] text-muted-foreground">
                        {billCount} {billCount === 1 ? "bill" : "bills"}
                      </div>
                    )}
                    {entry.cashOut > 0 && (
                      <div className="text-[length:var(--cal-detail-size)] font-medium text-red-600 dark:text-red-400">
                        -{formatCompactCurrency(entry.cashOut)} out
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-4 text-[length:var(--font-size-caption)] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="text-[length:var(--cal-detail-size)] font-bold text-emerald-500">$</span> Cash Remaining
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[length:var(--cal-detail-size)] font-medium text-emerald-500">+$</span> Incoming Total
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[length:var(--cal-detail-size)] text-muted-foreground">#</span> Bill Count
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[length:var(--cal-detail-size)] font-medium text-red-500">-$</span> Outgoing Total
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && selectedEntry && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-6 shadow-xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </h3>
                  <p className={`data-value text-xl font-bold ${selectedEntry.endBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatFullCurrency(selectedEntry.endBalance)}
                  </p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-emerald-500">Cash In</h4>
                  {selectedEntry.transactions.filter((t) => t.type === "in").length > 0 ? (
                    <div className="space-y-1">
                      {selectedEntry.transactions.filter((t) => t.type === "in").map((t, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-sm text-foreground">{t.label}</span>
                          </div>
                          <span className="text-sm font-semibold text-emerald-500">
                            {formatFullCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No inflows</p>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-red-500">Cash Out</h4>
                  {selectedEntry.transactions.filter((t) => t.type === "out").length > 0 ? (
                    <div className="space-y-1">
                      {selectedEntry.transactions.filter((t) => t.type === "out").map((t, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-red-500/5 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-sm text-foreground">{t.label}</span>
                          </div>
                          <span className="text-sm font-semibold text-red-500">
                            {formatFullCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No outflows</p>
                  )}
                </div>
              </div>

              <p className="mt-6 text-center text-[length:var(--font-size-caption)] text-muted-foreground">
                Data prepared by your Fusion Cell team
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
