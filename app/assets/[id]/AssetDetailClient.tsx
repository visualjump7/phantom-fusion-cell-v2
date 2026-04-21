"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, DollarSign, Calendar, MessageSquare,
  Building2, AlertTriangle, CheckCircle, HelpCircle, Bell,
  TrendingUp, Upload, Plus, ThumbsUp, ThumbsDown, Eye,
  ShieldCheck, X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { fetchBillsForAsset, Bill } from "@/lib/bill-service";
import { formatCentsToDisplay } from "@/lib/bill-parser";
import { BudgetView } from "@/components/budget/BudgetView";
import { useRole } from "@/lib/use-role";
import { useThemePreferences } from "@/components/ThemeProvider";
import { useScopedOrgId } from "@/lib/use-active-principal";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import {
  fetchMessages, respondToMessage, getMessageStatus,
  Message,
} from "@/lib/message-service";
import { useDelegateAccess } from "@/lib/use-delegate-access";
import { ProjectDetailPage } from "@/components/project-detail/ProjectDetailPage";

interface Asset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
  description: string | null;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function AssetDetailPage() {
  const params = useParams();
  const { isAdmin, isDelegate } = useRole();
  const { density } = useThemePreferences();
  const { scopedOrgId } = useScopedOrgId();
  const { hasAccess, isLoading: delegateAccessLoading } = useDelegateAccess();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasBudget, setHasBudget] = useState(false);
  const [budgetMonthly, setBudgetMonthly] = useState<number[]>(Array(12).fill(0));
  const [budgetFixedMonthly, setBudgetFixedMonthly] = useState<number[]>(Array(12).fill(0));
  const [budgetVariableMonthly, setBudgetVariableMonthly] = useState<number[]>(Array(12).fill(0));
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "budget" | "bills" | "messages" | "detail">("overview");
  const [overviewBudgetViewMode, setOverviewBudgetViewMode] = useState<"yearly" | "monthly">("monthly");
  const [overviewSelectedMonth, setOverviewSelectedMonth] = useState(new Date().getMonth());

  const [respondingTo, setRespondingTo] = useState<Message | null>(null);
  const [respondAction, setRespondAction] = useState<"approved" | "rejected" | null>(null);
  const [respondComment, setRespondComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (delegateAccessLoading) return;
    async function loadData() {
      const id = params.id as string;
      if (!id) {
        setIsLoading(false);
        setAsset(null);
        return;
      }

      // Delegate access check
      if (isDelegate && !hasAccess(id)) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }
      try {
      const [assetRes, billsData, assetMessages, budgetRes] = await Promise.all([
        scopedOrgId
          ? db.from("assets").select("*").eq("id", id).eq("organization_id", scopedOrgId).single()
          : db.from("assets").select("*").eq("id", id).single(),
        fetchBillsForAsset(id),
        fetchMessages({ asset_id: id }),
        db.from("budgets").select("id").eq("asset_id", id).limit(1),
      ]);
      setAsset(assetRes.data);
      setBills(billsData);
      setMessages(assetMessages);
      const budgetExists = budgetRes.data && budgetRes.data.length > 0;
      setHasBudget(budgetExists);

      if (budgetExists) {
        const latestBudget = budgetRes.data[0];
        const { data: budgetItems } = await db
          .from("budget_line_items")
          .select("jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec,annual_total")
          .eq("budget_id", latestBudget.id);
        if (budgetItems) {
          const keys = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
          const totals = keys.map((k) => budgetItems.reduce((s: number, li: any) => s + (li[k] || 0), 0));
          setBudgetMonthly(totals);
          const isFixed = (li: any) => {
            const vals = keys.map((k) => li[k] || 0).filter((v: number) => v > 0);
            if (vals.length < 2) return false;
            const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
            return avg > 0 && vals.every((v: number) => Math.abs(v - avg) / avg < 0.05);
          };
          const fixedItems = budgetItems.filter(isFixed);
          const variableItems = budgetItems.filter((li: any) => !isFixed(li));
          setBudgetFixedMonthly(keys.map((k) => fixedItems.reduce((s: number, li: any) => s + (li[k] || 0), 0)));
          setBudgetVariableMonthly(keys.map((k) => variableItems.reduce((s: number, li: any) => s + (li[k] || 0), 0)));
        }
      }

      setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        console.error("Asset detail loadData error:", err);
      }
    }
    loadData();
  }, [params.id, scopedOrgId, delegateAccessLoading, isDelegate]);

  const openResponseModal = (msg: Message, action: "approved" | "rejected") => {
    setRespondingTo(msg);
    setRespondAction(action);
    setRespondComment("");
  };

  const handleQuickAcknowledge = async (messageId: string) => {
    setIsSubmitting(true);
    await respondToMessage(messageId, "acknowledged");
    const updated = await fetchMessages({ asset_id: params.id as string });
    setMessages(updated);
    setIsSubmitting(false);
  };

  const handleConfirmResponse = async () => {
    if (!respondingTo || !respondAction) return;
    setIsSubmitting(true);
    const result = await respondToMessage(respondingTo.id, respondAction, respondComment || undefined);
    if (result.success) {
      setRespondingTo(null);
      setRespondComment("");
      setRespondAction(null);
      const updated = await fetchMessages({ asset_id: params.id as string });
      setMessages(updated);
    }
    setIsSubmitting(false);
  };

  const pendingBills = bills.filter((b) => b.status === "pending");
  const paidBills = bills.filter((b) => b.status === "paid");
  const totalPending = pendingBills.reduce((s, b) => s + b.amount_cents, 0);

  const categoryColors: Record<string, string> = {
    family: "bg-emerald-600 text-white border-emerald-600",
    business: "bg-blue-600 text-white border-blue-600",
    personal: "bg-violet-600 text-white border-violet-600",
  };

  const typeIcons: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    action_required: <CheckCircle className="h-4 w-4 text-orange-400" />,
    decision: <HelpCircle className="h-4 w-4 text-blue-400" />,
    update: <Bell className="h-4 w-4 text-muted-foreground" />,
    comment: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
  };

  const costOutlook = useMemo(() => {
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return MONTH_NAMES.map((label, i) => ({
      label,
      total: budgetMonthly[i] || 0,
      fixed: budgetFixedMonthly[i] || 0,
      variable: budgetVariableMonthly[i] || 0,
    }));
  }, [budgetMonthly, budgetFixedMonthly, budgetVariableMonthly]);

  const sparklineData = useMemo(() => {
    const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return MONTH_LABELS.map((m, i) => ({ month: m, total: budgetMonthly[i] || 0 }));
  }, [budgetMonthly]);

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const overviewAnnualTotal = useMemo(() => budgetMonthly.reduce((s, v) => s + v, 0), [budgetMonthly]);
  const overviewFixedTotal = useMemo(() => budgetFixedMonthly.reduce((s, v) => s + v, 0), [budgetFixedMonthly]);
  const overviewVariableTotal = useMemo(() => budgetVariableMonthly.reduce((s, v) => s + v, 0), [budgetVariableMonthly]);
  const overviewMonthlyAvg = overviewAnnualTotal / 12;
  const overviewSelectedMonthTotal = budgetMonthly[overviewSelectedMonth] || 0;
  const overviewSelectedMonthFixed = budgetFixedMonthly[overviewSelectedMonth] || 0;
  const overviewSelectedMonthVariable = budgetVariableMonthly[overviewSelectedMonth] || 0;
  const overviewMonthDiff = overviewSelectedMonthTotal - overviewMonthlyAvg;

  const formatCompact = (val: number) =>
    `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatChartVal = (val: number) =>
    val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `$${Math.round(val / 1000)}K` : `$${val}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <p className="text-muted-foreground">You do not have access to this project</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/assets">Back to My Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <p className="text-muted-foreground">Project not found</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/assets">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link href="/assets" className="mb-6 inline-flex items-center gap-2 text-[length:var(--font-size-body)] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={`capitalize ${categoryColors[asset.category] || ""}`}>
                {asset.category}
              </Badge>
            </div>
            <h1 className="page-title mt-2 font-bold text-foreground">{asset.name}</h1>
            {asset.description && <p className="mt-1 text-[length:var(--font-size-body)] text-muted-foreground">{asset.description}</p>}
          </div>
          <div className="text-right">
            <p className="data-value text-[length:var(--font-size-page-title)] font-bold text-primary">{formatCurrency(asset.estimated_value)}</p>
            <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Estimated Value</p>
          </div>
        </div>

        {/* Tabs — horizontal scroll on narrow viewports so 5 tabs don't wrap to 2-3 tall rows. */}
        <div className="-mx-3 mb-6 overflow-x-auto sm:mx-0">
          <div className="mx-3 flex gap-1 rounded-lg bg-muted/30 p-1 sm:mx-0 sm:flex-wrap">
            {(["overview", "budget", "bills", "messages", "detail"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex min-h-[var(--tap-target-min)] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[length:var(--font-size-body)] font-medium capitalize transition-colors sm:gap-2 sm:px-4 ${
                  activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "detail" && <Building2 className="h-4 w-4" />}
                {tab === "budget" && <TrendingUp className="h-4 w-4" />}
                {tab === "overview" && <DollarSign className="h-4 w-4" />}
                {tab === "bills" && <Calendar className="h-4 w-4" />}
                {tab === "messages" && <MessageSquare className="h-4 w-4" />}
                {tab === "messages" ? "Alerts" : tab === "detail" ? "Details" : tab}
                {tab === "bills" && pendingBills.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">{pendingBills.length}</Badge>
                )}
                {tab === "messages" && messages.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">{messages.length}</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ DETAIL TAB ═══ */}
        {activeTab === "detail" && asset && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ProjectDetailPage
              assetId={asset.id}
              orgId={scopedOrgId || ""}
              assetName={asset.name}
            />
          </motion.div>
        )}

        {/* ═══ BUDGET TAB ═══ */}
        {activeTab === "budget" && (
          <div>
            {isAdmin && (
              <div className="mb-4 flex justify-end">
                <Link href={`/upload?asset=${asset.id}&year=${new Date().getFullYear()}`}>
                  <Button variant={hasBudget ? "outline" : "default"} size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    {hasBudget ? "Update Budget" : "Upload Budget"}
                  </Button>
                </Link>
              </div>
            )}
            <BudgetView assetId={asset.id} />
          </div>
        )}

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Row 1: Budget Summary + Monthly Burn (when has budget) */}
            {hasBudget && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border bg-card/60">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-foreground">Budget Summary</h3>
                      <div className="flex rounded-lg bg-muted/50 p-0.5">
                        <button
                          onClick={() => setOverviewBudgetViewMode("yearly")}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${overviewBudgetViewMode === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Yearly
                        </button>
                        <button
                          onClick={() => setOverviewBudgetViewMode("monthly")}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${overviewBudgetViewMode === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Monthly
                        </button>
                      </div>
                    </div>
                    <AnimatePresence mode="wait">
                      {overviewBudgetViewMode === "yearly" ? (
                        <motion.div key="yearly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                          <p className="data-value text-[length:var(--font-size-page-title)] font-bold text-primary">{formatCurrency(overviewAnnualTotal)}</p>
                          <p className="text-[length:var(--font-size-caption)] text-muted-foreground mb-4">Annual Budget</p>
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-blue-400">Fixed: {formatCurrency(overviewFixedTotal)}</span>
                              <span className="text-orange-400">Variable: {formatCurrency(overviewVariableTotal)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                              <div className="h-full bg-blue-500 rounded-l-full" style={{ width: `${overviewAnnualTotal > 0 ? (overviewFixedTotal / overviewAnnualTotal) * 100 : 0}%` }} />
                              <div className="h-full bg-orange-500 rounded-r-full" style={{ width: `${overviewAnnualTotal > 0 ? (overviewVariableTotal / overviewAnnualTotal) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-background/50 p-3 text-center">
                              <p className="data-value font-bold text-foreground">{formatCurrency(overviewMonthlyAvg)}</p>
                              <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Monthly Avg</p>
                            </div>
                            <div className="rounded-lg bg-background/50 p-3 text-center">
                              <p className="data-value font-bold text-foreground">{formatCurrency(overviewAnnualTotal)}</p>
                              <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Annual Total</p>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="monthly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                            {MONTHS.map((m, i) => (
                              <button
                                key={m}
                                onClick={() => setOverviewSelectedMonth(i)}
                                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${overviewSelectedMonth === i ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          <p className="data-value text-[length:var(--font-size-page-title)] font-bold text-primary">{formatCurrency(overviewSelectedMonthTotal)}</p>
                          <p className="text-[length:var(--font-size-caption)] text-muted-foreground mb-4">{MONTHS[overviewSelectedMonth]} Expenses</p>
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-blue-400">Fixed: {formatCurrency(overviewSelectedMonthFixed)}</span>
                              <span className="text-orange-400">Variable: {formatCurrency(overviewSelectedMonthVariable)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                              <div className="h-full bg-blue-500 rounded-l-full" style={{ width: `${overviewSelectedMonthTotal > 0 ? (overviewSelectedMonthFixed / overviewSelectedMonthTotal) * 100 : 0}%` }} />
                              <div className="h-full bg-orange-500 rounded-r-full" style={{ width: `${overviewSelectedMonthTotal > 0 ? (overviewSelectedMonthVariable / overviewSelectedMonthTotal) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-background/50 p-3 text-center">
                              <p className={`text-lg font-bold ${overviewMonthDiff >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                                {overviewMonthDiff >= 0 ? "+" : "-"}{formatCurrency(Math.abs(overviewMonthDiff))}
                              </p>
                              <p className="text-[length:var(--font-size-caption)] text-muted-foreground">vs. Monthly Avg</p>
                            </div>
                            <div className="rounded-lg bg-background/50 p-3 text-center">
                              <p className="data-value font-bold text-foreground">{formatCurrency(overviewMonthlyAvg)}</p>
                              <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Monthly Avg</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>

                {/* Monthly Burn */}
                <Card className="border-border bg-card/60">
                  <CardContent className="p-6">
                    <h3 className="text-base font-semibold text-foreground mb-4">Monthly Burn</h3>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                          <defs>
                            <linearGradient id="overviewBurnGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="month"
                            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v: number) => formatChartVal(v)}
                            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                          />
                          <Tooltip
                            formatter={(value: number) => [formatCurrency(value), ""]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="total"
                            stroke="var(--chart-1)"
                            strokeWidth={2}
                            fill="url(#overviewBurnGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Row 2: Stats */}
            <div className={density === "comfort" ? "grid gap-[var(--gap)] grid-cols-1 md:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
              <Card className="border-border bg-card/60">
                <CardContent className="p-5">
                  <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Estimated Value</p>
                  <p className="data-value mt-1 text-[length:var(--font-size-section-header)] font-bold text-foreground">{formatCurrency(asset.estimated_value)}</p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/60">
                <CardContent className="p-5">
                  <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Pending Bills</p>
                  <p className="data-value mt-1 text-[length:var(--font-size-section-header)] font-bold text-foreground">{pendingBills.length}</p>
                  <p className="text-[length:var(--font-size-caption)] text-muted-foreground">{formatCentsToDisplay(totalPending)} due</p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/60">
                <CardContent className="p-5">
                  <p className="text-[length:var(--font-size-caption)] text-muted-foreground">Alerts</p>
                  <p className="data-value mt-1 text-[length:var(--font-size-section-header)] font-bold text-foreground">{messages.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Cost Outlook + Sparkline (when has budget) */}
            {hasBudget && (
              <>
                {/* Cost Outlook */}
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Cost Outlook</h3>
                  <p className="text-xs text-muted-foreground mb-4">Projected costs for this asset</p>
                  <div className={density === "comfort" ? "grid gap-[var(--gap)] grid-cols-1 md:grid-cols-2" : "grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}>
                    {costOutlook.map((period, i) => {
                      const isCurrent = i === new Date().getMonth();
                      return (
                        <Card key={period.label} className={`border-border bg-card/60 ${isCurrent ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
                          <CardContent className="p-3">
                            <p className={`text-xs font-medium mb-1 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>{period.label}</p>
                            <p className="text-base font-bold text-foreground">{formatCompact(period.total)}</p>
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-[10px] text-blue-400">F: {formatCompact(period.fixed)}</p>
                              <p className="text-[10px] text-orange-400">V: {formatCompact(period.variable)}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Row 3: Sparkline */}
                <Card className="border-border bg-card/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-2">12-Month Cost Trend</p>
                    <div className="h-[60px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={1.5} fill="url(#sparkGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </motion.div>
        )}

        {/* ═══ BILLS TAB ═══ */}
        {activeTab === "bills" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Linked Bills</CardTitle>
                {isAdmin && (
                  <Link href={`/admin/bills?asset=${asset.id}`}>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" /> Add Bill
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {bills.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No bills linked to this project</p>
                ) : (
                  <div className="density-table-wrap">
                    <table className="density-table">
                      <thead>
                        <tr>
                          <th className="sticky-first-col min-w-[160px] md:min-w-[240px]">Bill</th>
                          <th className="min-w-[110px] md:min-w-[140px]">Due date</th>
                          <th className="min-w-[110px] md:min-w-[150px]">Status</th>
                          {/* Category is secondary info — hide on mobile to let the 4 primary columns breathe. */}
                          <th className="hidden md:table-cell min-w-[150px]">Category</th>
                          <th className="text-right min-w-[110px] md:min-w-[150px]">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((bill) => {
                          const isPending = bill.status === "pending";
                          return (
                            <tr key={bill.id}>
                              <td className="sticky-first-col text-[length:var(--font-size-body)] font-medium text-foreground">{bill.title}</td>
                              <td className="text-[length:var(--font-size-body)] text-muted-foreground">{bill.due_date}</td>
                              <td>
                                <span className="inline-flex items-center gap-2 text-[length:var(--font-size-caption)] font-medium" style={{ color: isPending ? "var(--color-warning)" : "var(--color-success)" }}>
                                  {isPending ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                  {isPending ? "Pending" : "Paid"}
                                </span>
                              </td>
                              <td className="hidden md:table-cell text-[length:var(--font-size-body)] text-foreground">{bill.category || "—"}</td>
                              <td className={`number-cell ${isPending ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                {formatCentsToDisplay(bill.amount_cents)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ MESSAGES TAB ═══ */}
        {activeTab === "messages" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Project Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No alerts for this project</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const status = getMessageStatus(msg);
                      return (
                        <div key={msg.id} className={`rounded-lg bg-background/30 ${density === "comfort" ? "p-[var(--card-padding)]" : "p-4"}`}>
                          <div className="flex items-start gap-3">
                            {typeIcons[msg.type] ?? typeIcons.comment}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{msg.title}</p>
                              {msg.body && <p className="mt-1 text-xs text-muted-foreground">{msg.body}</p>}
                              <div className={`mt-2 flex items-center ${density === "comfort" ? "gap-4" : "gap-2"}`}>
                                <Badge variant="outline" className="text-[10px] capitalize">{msg.type.replace("_", " ")}</Badge>
                                <Badge variant="outline" className="text-[10px]">{msg.priority}</Badge>
                              </div>

                              {status === "approved" && !msg.response?.confirmed_at && (
                                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                                  <div className="flex items-center gap-2">
                                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-xs font-semibold text-emerald-400">Approved</span>
                                  </div>
                                  {msg.response?.comment && (
                                    <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{msg.response.comment}&rdquo;</p>
                                  )}
                                  <p className="mt-1 text-[10px] text-amber-400">Awaiting team confirmation</p>
                                </div>
                              )}

                              {status === "rejected" && !msg.response?.confirmed_at && (
                                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                                  <div className="flex items-center gap-2">
                                    <ThumbsDown className="h-3.5 w-3.5 text-red-400" />
                                    <span className="text-xs font-semibold text-red-400">Rejected</span>
                                  </div>
                                  {msg.response?.comment && (
                                    <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{msg.response.comment}&rdquo;</p>
                                  )}
                                  <p className="mt-1 text-[10px] text-amber-400">Awaiting team confirmation</p>
                                </div>
                              )}

                              {status === "confirmed" && (
                                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-semibold text-primary">
                                      {msg.response?.response_type === "approved" ? "Approved" : "Rejected"} &amp; Confirmed
                                    </span>
                                  </div>
                                </div>
                              )}

                              {status === "acknowledged" && (
                                <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="text-xs font-semibold text-blue-400">Acknowledged</span>
                                  </div>
                                </div>
                              )}

                              {status === "pending" && (msg.type === "decision" || msg.type === "action_required") && (
                                <div className="decision-actions mt-3">
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => openResponseModal(msg, "approved")} disabled={isSubmitting}>
                                    <ThumbsUp className="mr-1.5 h-3 w-3" />Approve
                                  </Button>
                                  <Button size="sm" className="bg-red-600 text-white hover:bg-red-700"
                                    onClick={() => openResponseModal(msg, "rejected")} disabled={isSubmitting}>
                                    <ThumbsDown className="mr-1.5 h-3 w-3" />Reject
                                  </Button>
                                  <Button size="sm" variant={density === "comfort" ? "secondary" : "ghost"} className={density === "comfort" ? "" : "text-xs text-muted-foreground"}
                                    onClick={() => handleQuickAcknowledge(msg.id)} disabled={isSubmitting}>
                                    <Eye className="mr-1.5 h-3 w-3" />Acknowledge
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.main>

      {/* ═══ RESPONSE CONFIRMATION MODAL ═══ */}
      <AnimatePresence>
        {respondingTo && respondAction && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setRespondingTo(null); setRespondAction(null); }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {respondAction === "approved"
                    ? <ThumbsUp className="h-5 w-5 text-emerald-400" />
                    : <ThumbsDown className="h-5 w-5 text-red-400" />}
                  <h3 className="text-lg font-semibold text-foreground">
                    {respondAction === "approved" ? "Approve" : "Reject"}
                  </h3>
                </div>
                <button onClick={() => { setRespondingTo(null); setRespondAction(null); }}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="mb-4 rounded-lg bg-background/50 p-3">
                <p className="text-sm font-medium text-foreground">{respondingTo.title}</p>
                {respondingTo.body && <p className="mt-1 text-xs text-muted-foreground">{respondingTo.body}</p>}
              </div>
              <textarea value={respondComment} onChange={(e) => setRespondComment(e.target.value)}
                placeholder="Add a note (optional)..." rows={3} autoFocus
                className="mb-4 min-h-[var(--tap-target-min)] w-full rounded-lg border border-border bg-background px-3 py-2 text-[length:var(--font-size-body)] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setRespondingTo(null); setRespondAction(null); }}>Cancel</Button>
                <Button size="sm"
                  className={respondAction === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                  onClick={handleConfirmResponse} disabled={isSubmitting}>
                  {respondAction === "approved" ? <ThumbsUp className="mr-1.5 h-3 w-3" /> : <ThumbsDown className="mr-1.5 h-3 w-3" />}
                  Confirm {respondAction === "approved" ? "Approval" : "Rejection"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
