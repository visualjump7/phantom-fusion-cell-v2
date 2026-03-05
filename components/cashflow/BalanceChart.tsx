"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { DailyEntry, formatCompactCurrency, formatFullCurrency } from "@/lib/cashflow";

interface BalanceChartProps {
  entries: DailyEntry[];
  defaultRange?: string;
}

type TimeRange = "30D" | "90D" | "6M" | "1Y" | "All";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatTick(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">
        {new Date(label + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", year: "numeric",
        })}
      </p>
      <div className="space-y-0.5">
        <p className={d.endBalance >= 0 ? "text-emerald-500" : "text-red-500"}>
          Balance: {formatFullCurrency(d.endBalance)}
        </p>
        {d.cashIn > 0 && (
          <p className="text-emerald-500">In: {formatFullCurrency(d.cashIn)}</p>
        )}
        {d.cashOut > 0 && (
          <p className="text-red-500">Out: {formatFullCurrency(d.cashOut)}</p>
        )}
      </div>
    </div>
  );
}

export function BalanceChart({ entries, defaultRange = "90D" }: BalanceChartProps) {
  const [range, setRange] = useState<TimeRange>(defaultRange as TimeRange);
  const today = new Date().toISOString().split("T")[0];

  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;

    switch (range) {
      case "30D": start = addDays(now, -15); break;
      case "90D": start = addDays(now, -45); break;
      case "6M": start = addDays(now, -90); break;
      case "1Y": start = addDays(now, -180); break;
      case "All":
      default: return entries;
    }

    const endDays = range === "30D" ? 15 : range === "90D" ? 45 : range === "6M" ? 90 : 180;
    const end = addDays(now, endDays);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    let filtered = entries.filter((e) => e.date >= startStr && e.date <= endStr);

    if (range === "1Y") {
      filtered = filtered.filter((_, i) => i % 2 === 0 || filtered[i]?.date === today);
    }

    return filtered;
  }, [entries, range, today]);

  const chartData = useMemo(() => {
    return filteredData.map((e) => ({
      date: e.date,
      endBalance: e.endBalance,
      positive: e.endBalance >= 0 ? e.endBalance : null,
      negative: e.endBalance < 0 ? e.endBalance : null,
      cashIn: e.cashIn,
      cashOut: e.cashOut,
    }));
  }, [filteredData]);

  const ranges: TimeRange[] = ["30D", "90D", "6M", "1Y", "All"];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1.5 text-[length:var(--font-size-body)] font-medium transition-colors ${
              range === r
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              tickFormatter={(v: number) => formatCompactCurrency(v)}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="4 4" />
            <ReferenceLine x={today} stroke="#888" strokeDasharray="3 3" label={{ value: "Today", position: "top", fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="positive"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="negative"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
