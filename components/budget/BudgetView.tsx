"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
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
    () => categoryGroups.map((g) => ({
      name: g.name,
      value: g.total,
      color: g.color,
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

  // ─── PIE LABEL ───

  const renderPieLabel = ({ name, pct, value }: any) => null; // using legend instead

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
      {/* ROW 1: Summary + Monthly Burn */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget Summary */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Budget Summary</h3>
              {availableYears.length > 1 ? (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-muted-foreground">{selectedYear}</span>
              )}
            </div>

            <p className="text-3xl font-bold text-primary">{formatFull(annualTotal)}</p>
            <p className="text-xs text-muted-foreground mb-4">Annual Budget</p>

            {/* Fixed vs Variable bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-blue-400">Fixed: {formatFull(fixedTotal)}</span>
                <span className="text-orange-400">Variable: {formatFull(variableTotal)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 rounded-l-full"
                  style={{ width: `${(fixedTotal / annualTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-orange-500 rounded-r-full"
                  style={{ width: `${(variableTotal / annualTotal) * 100}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{formatFull(annualTotal / 12)}</p>
                <p className="text-[10px] text-muted-foreground">Monthly Avg</p>
              </div>
              <div className="rounded-lg bg-background/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{lineItems.length}</p>
                <p className="text-[10px] text-muted-foreground">Line Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Burn Chart */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Monthly Burn</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7ac142" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7ac142" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatK}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#7ac142"
                    strokeWidth={2}
                    fill="url(#burnGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROW 2: Category Breakdown */}
      <Card className="border-border bg-card/60">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Category Breakdown</h3>
          <div className="flex flex-col items-center gap-6 lg:flex-row">
            {/* Donut Chart */}
            <div className="w-full lg:w-1/2 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatFull(value), ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="w-full lg:w-1/2 space-y-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-foreground">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground mr-2">{entry.pct}%</span>
                    <span className="text-sm font-semibold text-foreground">{formatK(entry.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ROW 3: Line Items */}
      <Card className="border-border bg-card/60">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">Line Items</h3>
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-9 text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-1">
            {filteredGroups.map((group) => {
              const isExpanded = expandedCategories.has(group.name);
              return (
                <div key={group.name}>
                  {/* Category header */}
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

                  {/* Expanded items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 mb-2 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-1.5 pr-2 font-medium min-w-[180px]">Line Item</th>
                                {MONTHS.map((m) => (
                                  <th key={m} className="text-right py-1.5 px-1.5 font-medium min-w-[70px]">{m}</th>
                                ))}
                                <th className="text-right py-1.5 pl-2 font-semibold min-w-[85px]">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item) => (
                                <tr key={item.id} className="border-t border-border/30 hover:bg-muted/10">
                                  <td className="py-2 pr-2 font-medium text-foreground truncate max-w-[200px]" title={item.description}>
                                    {item.description}
                                  </td>
                                  {MONTH_KEYS.map((key) => (
                                    <td key={key} className={`text-right py-2 px-1.5 tabular-nums ${item[key] > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                                      {item[key] > 0 ? formatK(item[key]) : "—"}
                                    </td>
                                  ))}
                                  <td className="text-right py-2 pl-2 font-semibold text-foreground tabular-nums">
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
      </Card>
    </motion.div>
  );
}
