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
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  fetchMessages, respondToMessage, getMessageStatus,
  Message,
} from "@/lib/message-service";

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
  const { isAdmin } = useRole();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasBudget, setHasBudget] = useState(false);
  const [budgetMonthly, setBudgetMonthly] = useState<number[]>(Array(12).fill(0));
  const [budgetFixedMonthly, setBudgetFixedMonthly] = useState<number[]>(Array(12).fill(0));
  const [budgetVariableMonthly, setBudgetVariableMonthly] = useState<number[]>(Array(12).fill(0));
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"budget" | "overview" | "bills" | "messages">("budget");

  const [respondingTo, setRespondingTo] = useState<Message | null>(null);
  const [respondAction, setRespondAction] = useState<"approved" | "rejected" | null>(null);
  const [respondComment, setRespondComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const id = params.id as string;
      const [assetRes, billsData, assetMessages, budgetRes] = await Promise.all([
        db.from("assets").select("*").eq("id", id).single(),
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
        setActiveTab("budget");
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
      } else {
        setActiveTab("overview");
      }

      setIsLoading(false);
    }
    loadData();
  }, [params.id]);

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
    const curMonth = new Date().getMonth();
    const periods = [
      { label: "This Month", months: 1 },
      { label: "Next 3 Mo.", months: 3 },
      { label: "Next 6 Mo.", months: 6 },
      { label: "Next 12 Mo.", months: 12 },
    ];
    return periods.map(({ label, months }) => {
      let total = 0, fixed = 0, variable = 0;
      for (let i = 0; i < months; i++) {
        const idx = (curMonth + i) % 12;
        total += budgetMonthly[idx] || 0;
        fixed += budgetFixedMonthly[idx] || 0;
        variable += budgetVariableMonthly[idx] || 0;
      }
      return { label, total, fixed, variable };
    });
  }, [budgetMonthly, budgetFixedMonthly, budgetVariableMonthly]);

  const sparklineData = useMemo(() => {
    const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return MONTH_LABELS.map((m, i) => ({ month: m, total: budgetMonthly[i] || 0 }));
  }, [budgetMonthly]);

  const formatCompact = (val: number) =>
    `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

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

  if (!asset) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <p className="text-muted-foreground">Asset not found</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/assets">Back to Assets</Link>
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
        <Link href="/assets" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Assets
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={`capitalize ${categoryColors[asset.category] || ""}`}>
                {asset.category}
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-bold text-foreground">{asset.name}</h1>
            {asset.description && <p className="mt-1 text-sm text-muted-foreground">{asset.description}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{formatCurrency(asset.estimated_value)}</p>
            <p className="text-xs text-muted-foreground">Estimated Value</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted/30 p-1">
          {(["budget", "overview", "bills", "messages"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "budget" && <TrendingUp className="h-4 w-4" />}
              {tab === "overview" && <DollarSign className="h-4 w-4" />}
              {tab === "bills" && <Calendar className="h-4 w-4" />}
              {tab === "messages" && <MessageSquare className="h-4 w-4" />}
              {tab}
              {tab === "bills" && pendingBills.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{pendingBills.length}</Badge>
              )}
              {tab === "messages" && messages.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{messages.length}</Badge>
              )}
            </button>
          ))}
        </div>

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
            {/* Row 1: Existing stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border bg-card/60">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Estimated Value</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(asset.estimated_value)}</p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/60">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Pending Bills</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{pendingBills.length}</p>
                  <p className="text-xs text-muted-foreground">{formatCentsToDisplay(totalPending)} due</p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/60">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Messages</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{messages.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Cost Outlook */}
            {hasBudget && (
              <>
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Cost Outlook</h3>
                  <p className="text-xs text-muted-foreground mb-4">Projected costs for this asset</p>
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {costOutlook.map((period, i) => (
                      <Card key={period.label} className={`border-border bg-card/60 ${i === 0 ? "border-primary/30" : ""}`}>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-2">{period.label}</p>
                          <p className="text-xl font-bold text-foreground">{formatCompact(period.total)}</p>
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[10px] text-blue-400">Fixed: {formatCompact(period.fixed)}</p>
                            <p className="text-[10px] text-orange-400">Variable: {formatCompact(period.variable)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
                              <stop offset="0%" stopColor="#7ac142" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#7ac142" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="total" stroke="#7ac142" strokeWidth={1.5} fill="url(#sparkGradient)" />
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
                  <p className="text-sm text-muted-foreground italic">No bills linked to this asset</p>
                ) : (
                  <div className="space-y-2">
                    {pendingBills.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between rounded-lg bg-background/30 p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{bill.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{bill.due_date}</span>
                            {bill.category && <Badge variant="outline" className="text-[10px]">{bill.category}</Badge>}
                            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">pending</Badge>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-foreground">{formatCentsToDisplay(bill.amount_cents)}</p>
                      </div>
                    ))}
                    {paidBills.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between rounded-lg bg-background/30 p-3 opacity-60">
                        <div>
                          <p className="text-sm font-medium text-foreground">{bill.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{bill.due_date}</span>
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">paid</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-through">{formatCentsToDisplay(bill.amount_cents)}</p>
                      </div>
                    ))}
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
                <CardTitle className="text-base">Asset Messages</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No messages for this asset</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const status = getMessageStatus(msg);
                      return (
                        <div key={msg.id} className="rounded-lg bg-background/30 p-4">
                          <div className="flex items-start gap-3">
                            {typeIcons[msg.type]}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{msg.title}</p>
                              {msg.body && <p className="mt-1 text-xs text-muted-foreground">{msg.body}</p>}
                              <div className="mt-2 flex items-center gap-2">
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
                                <div className="mt-3 flex items-center gap-2">
                                  <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => openResponseModal(msg, "approved")} disabled={isSubmitting}>
                                    <ThumbsUp className="mr-1.5 h-3 w-3" />Approve
                                  </Button>
                                  <Button size="sm" variant="outline"
                                    className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    onClick={() => openResponseModal(msg, "rejected")} disabled={isSubmitting}>
                                    <ThumbsDown className="mr-1.5 h-3 w-3" />Reject
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground"
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
                className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
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
