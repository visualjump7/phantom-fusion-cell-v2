"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, DollarSign, Calendar, MessageSquare,
  Building2, AlertTriangle, CheckCircle, HelpCircle, Bell,
  TrendingUp, Upload, Plus,
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

interface Asset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
  description: string | null;
  status: string;
}

interface Message {
  id: string;
  title: string;
  type: string;
  priority: string;
  body: string | null;
  created_at: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"budget" | "overview" | "bills" | "messages">("budget");

  useEffect(() => {
    async function loadData() {
      const id = params.id as string;
      const [assetRes, billsData, msgRes, budgetRes] = await Promise.all([
        db.from("assets").select("*").eq("id", id).single(),
        fetchBillsForAsset(id),
        db.from("messages").select("id, title, type, priority, body, created_at").eq("asset_id", id).eq("is_deleted", false).order("created_at", { ascending: false }),
        db.from("budgets").select("id").eq("asset_id", id).limit(1),
      ]);
      setAsset(assetRes.data);
      setBills(billsData);
      setMessages(msgRes.data || []);
      setHasBudget(budgetRes.data && budgetRes.data.length > 0);

      // Default to budget tab if budget exists, otherwise overview
      if (budgetRes.data && budgetRes.data.length > 0) {
        setActiveTab("budget");
      } else {
        setActiveTab("overview");
      }

      setIsLoading(false);
    }
    loadData();
  }, [params.id]);

  const pendingBills = bills.filter((b) => b.status === "pending");
  const paidBills = bills.filter((b) => b.status === "paid");
  const totalPending = pendingBills.reduce((s, b) => s + b.amount_cents, 0);

  const categoryColors: Record<string, string> = {
    family: "bg-emerald-400/10 text-emerald-400",
    business: "bg-blue-400/10 text-blue-400",
    personal: "bg-violet-400/10 text-violet-400",
  };

  const typeIcons: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    action_required: <CheckCircle className="h-4 w-4 text-orange-400" />,
    decision: <HelpCircle className="h-4 w-4 text-blue-400" />,
    update: <Bell className="h-4 w-4 text-muted-foreground" />,
    comment: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
  };

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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-3">
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
                    {messages.map((msg) => (
                      <div key={msg.id} className="rounded-lg bg-background/30 p-4">
                        <div className="flex items-start gap-3">
                          {typeIcons[msg.type]}
                          <div>
                            <p className="text-sm font-medium text-foreground">{msg.title}</p>
                            {msg.body && <p className="mt-1 text-xs text-muted-foreground">{msg.body}</p>}
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] capitalize">{msg.type.replace("_", " ")}</Badge>
                              <Badge variant="outline" className="text-[10px]">{msg.priority}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.main>
    </div>
  );
}
