"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Search, Loader2, TrendingUp, Upload,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface BudgetLineItem {
  id: string;
  description: string;
  expense_category_id: string;
  category_name: string;
  category_color: string;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
  annual_total: number;
}

interface CategoryGroup {
  name: string;
  color: string;
  items: BudgetLineItem[];
  total: number;
  isFixed: boolean; // true if all months are roughly equal
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function formatK(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${Math.round(val / 1000)}K`;
  return `$${val.toLocaleString()}`;
}

function formatFull(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isFixedCost(item: BudgetLineItem): boolean {
  const vals = MONTH_KEYS.map((k) => item[k]);
  const nonZero = vals.filter((v) => v > 0);
  if (nonZero.length < 6) return false; // sporadic = not fixed
  const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  return nonZero.every((v) => Math.abs(v - avg) / avg < 0.05);
}

interface BudgetViewProps {
  assetId: string;
}

export function BudgetView({ assetId }: BudgetViewProps) {
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showLineItems, setShowLineItems] = useState(false);
  const [viewMode, setViewMode] = useState<"yearly" | "monthly">("yearly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  useEffect(() => {
    async function loadBudget() {
      setIsLoading(true);

      // Get all budgets for this asset
      const { data: budgets } = await db
        .from("budgets")
        .select("id, year")
        .eq("asset_id", assetId)
        .order("year", { ascending: false });

      if (!budgets || budgets.length === 0) {
        setIsLoading(false);
        return;
      }

      const years = budgets.map((b: any) => b.year);
      setAvailableYears(years);

      const budget = budgets.find((b: any) => b.year === selectedYear) || budgets[0];
      if (budget.year !== selectedYear) setSelectedYear(budget.year);

      // Get line items with category info
      const { data: items } = await db
        .from("budget_line_items")
        .select("*, expense_categories:expense_category_id(name, color)")
        .eq("budget_id", budget.id)
        .order("annual_total", { ascending: false });

      if (items) {
        setLineItems(
          items.map((item: any) => ({
            ...item,
            category_name: item.expense_categories?.name || "Uncategorized",
            category_color: item.expense_categories?.color || "#64748b",
          }))
        );
      }

      setIsLoading(false);
    }

    loadBudget();
  }, [assetId, selectedYear]);

  // ─── COMPUTED DATA ───

  const annualTotal = useMemo(() => lineItems.reduce((s, li) => s + li.annual_total, 0), [lineItems]);

  const fixedTotal = useMemo(
    () => lineItems.filter(isFixedCost).reduce((s, li) => s + li.annual_total, 0),
    [lineItems]
  );
  const variableTotal = annualTotal - fixedTotal;

  const monthlyData = useMemo(() => {
    return MONTHS.map((month, i) => {
      const key = MONTH_KEYS[i];
      const total = lineItems.reduce((s, li) => s + (li[key] || 0), 0);
      return { month, total };
    });
  }, [lineItems]);

  const monthlyFixed = useMemo(() => {
    return MONTHS.map((_, i) => {
      const key = MONTH_KEYS[i];
      return lineItems.filter(isFixedCost).reduce((s, li) => s + (li[key] || 0), 0);
    });
  }, [lineItems]);

  const monthlyVariable = useMemo(() => {
    return MONTHS.map((_, i) => {
      const key = MONTH_KEYS[i];
      return lineItems.filter((li) => !isFixedCost(li)).reduce((s, li) => s + (li[key] || 0), 0);
    });
  }, [lineItems]);

  const monthlyAvg = annualTotal / 12;
  const selectedMonthTotal = monthlyData[selectedMonth]?.total || 0;
  const selectedMonthFixed = monthlyFixed[selectedMonth] || 0;
  const selectedMonthVariable = monthlyVariable[selectedMonth] || 0;
  const monthDiff = selectedMonthTotal - monthlyAvg;

  const categoryGroups: CategoryGroup[] = useMemo(() => {
    const map = new Map<string, CategoryGroup>();
    lineItems.forEach((item) => {
      const existing = map.get(item.category_name);
      if (existing) {
        existing.items.push(item);
        existing.total += item.annual_total;
      } else {
        map.set(item.category_name, {
          name: item.category_name,
          color: item.category_color,
          items: [item],
          total: item.annual_total,
          isFixed: isFixedCost(item),
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [lineItems]);

  const pieData = useMemo(
    () => categoryGroups.map((g, index) => ({
      name: g.name,
      value: g.total,
      color: CHART_COLORS[index % CHART_COLORS.length],
      pct: ((g.total / annualTotal) * 100).toFixed(1),
    })),
    [categoryGroups, annualTotal]
  );

  // Filter line items by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return categoryGroups;
    const q = searchQuery.toLowerCase();
    return categoryGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.description.toLowerCase().includes(q) ||
            g.name.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [categoryGroups, searchQuery]);

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // ─── CHART TOOLTIP ───

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-sm font-bold text-primary">{formatFull(payload[0].value)}</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (lineItems.length === 0) {
    return (
      <div className="text-center py-16">
        <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">No budget data for this asset</p>
        <p className="mt-1 text-xs text-muted-foreground">Upload a budget spreadsheet to get started</p>
        <Link href={`/upload?asset=${assetId}`}>
          <Button variant="outline" size="sm" className="mt-4">
            <Upload className="mr-2 h-4 w-4" />Upload Budget
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Category Breakdown Overview – Gantt-style bar chart */}
      <Card className="border-border bg-card/60">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold tracking-tight text-foreground mb-6">Category Breakdown Overview</h3>

          {/* Stacked bar */}
          <div className="mb-6">
            <div className="flex h-8 w-full overflow-hidden rounded-lg">
              {pieData.map((entry) => {
                const pctNum = parseFloat(entry.pct);
                if (pctNum < 0.5) return null;
                return (
                  <div
                    key={entry.name}
                    className="relative h-full transition-all group"
                    style={{ width: `${pctNum}%`, backgroundColor: entry.color }}
                    title={`${entry.name}: ${entry.pct}%`}
                  >
                    {pctNum > 6 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm truncate px-1">
                        {Math.round(pctNum)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category rows */}
          <div className="space-y-3">
            {pieData.map((entry) => {
              const pctNum = parseFloat(entry.pct);
              return (
                <div key={entry.name} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-[length:var(--font-size-body)] font-medium text-foreground truncate">
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-[length:var(--font-size-caption)] text-muted-foreground tabular-nums">
                        {entry.pct}%
                      </span>
                      <span className="text-[length:var(--font-size-body)] font-semibold text-foreground tabular-nums">
                        {formatK(entry.value)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctNum}%`, backgroundColor: entry.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Line Item Details – collapsible */}
      <Card className="border-border bg-card/60">
        <button
          onClick={() => setShowLineItems((prev) => !prev)}
          className="flex w-full items-center justify-between p-6 pb-0 text-left"
        >
          <h3 className="text-lg font-bold tracking-tight text-foreground">Line Item Details</h3>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${showLineItems ? "rotate-0" : "-rotate-90"}`} />
        </button>
        <AnimatePresence initial={false}>
          {showLineItems && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <CardContent className="p-6 pt-4">
                <div className="flex items-center justify-end mb-4">
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search items..."
                      className="pl-9 text-[length:var(--font-size-caption)]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  {filteredGroups.map((group) => {
                    const isExpanded = expandedCategories.has(group.name);
                    return (
                      <div key={group.name}>
                        <button
                          onClick={() => toggleCategory(group.name)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                            <span className="text-sm font-semibold text-foreground">{group.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {group.items.some(isFixedCost) ? "fixed" : "variable"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground">{group.items.length} items</span>
                            <span className="text-sm font-bold text-foreground">{formatFull(group.total)}</span>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-6 mb-2 density-table-wrap">
                                <table className="density-table">
                                  <thead>
                                    <tr>
                                      <th className="sticky-first-col min-w-[220px]">Line Item</th>
                                      {MONTHS.map((m) => (
                                        <th key={m} className="text-right min-w-[90px]">{m}</th>
                                      ))}
                                      <th className="text-right min-w-[120px]">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.items.map((item) => (
                                      <tr key={item.id} className="hover:bg-muted/10">
                                        <td className="sticky-first-col font-medium text-foreground truncate max-w-[220px] text-cell" title={item.description}>
                                          {item.description}
                                        </td>
                                        {MONTH_KEYS.map((key) => (
                                          <td key={key} className={`number-cell ${item[key] > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                                            {item[key] > 0 ? formatK(item[key]) : "—"}
                                          </td>
                                        ))}
                                        <td className="number-cell font-semibold text-foreground">
                                          {formatFull(item.annual_total)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
