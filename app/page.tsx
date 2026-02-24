"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Loader2,
  Building2,
  TrendingUp,
  DollarSign,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Bell,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashFlowCard } from "@/components/dashboard/CashFlowCard";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import {
  fetchBillSummary,
  fetchUpcomingBills,
  BillSummary,
  Bill,
} from "@/lib/bill-service";

interface Asset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
}

interface Message {
  id: string;
  title: string;
  type: string;
  priority: string;
  asset_id: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const { userName, isAdmin, isExecutive } = useRole();

  useEffect(() => {
    async function loadData() {
      try {
        const [assetRes, msgRes, summary, upcoming] = await Promise.all([
          db.from("assets").select("id, name, category, estimated_value").eq("is_deleted", false).order("estimated_value", { ascending: false }),
          db.from("messages").select("id, title, type, priority, asset_id, created_at").eq("is_deleted", false).eq("is_archived", false).order("created_at", { ascending: false }).limit(5),
          fetchBillSummary(),
          fetchUpcomingBills(7),
        ]);

        setAssets(assetRes.data || []);
        setMessages(msgRes.data || []);
        setBillSummary(summary);
        setUpcomingBills(upcoming);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const totalValue = assets.reduce((sum, a) => sum + (a.estimated_value || 0), 0);
  const categoryTotals = assets.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + (a.estimated_value || 0);
    return acc;
  }, {} as Record<string, number>);

  const categoryColors: Record<string, string> = {
    family: "text-emerald-400 bg-emerald-400/10",
    business: "text-blue-400 bg-blue-400/10",
    personal: "text-violet-400 bg-violet-400/10",
  };

  const typeIcons: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    action_required: <CheckCircle className="h-4 w-4 text-orange-400" />,
    decision: <HelpCircle className="h-4 w-4 text-blue-400" />,
    update: <Bell className="h-4 w-4 text-muted-foreground" />,
    comment: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
  };

  const priorityColors: Record<string, string> = {
    urgent: "border-red-500/50 text-red-400",
    high: "border-amber-500/50 text-amber-400",
    medium: "border-blue-500/50 text-blue-400",
    low: "border-border text-muted-foreground",
  };

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = userName ? userName.charAt(0).toUpperCase() + userName.slice(1) : "Guest";

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <Navbar />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isExecutive
              ? "Here\u2019s your financial overview"
              : "Fusion Cell command center"}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column */}
            <div className="space-y-6 lg:col-span-4">
              {/* Portfolio Value */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Portfolio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{assets.length} assets</p>
                    <div className="mt-4 space-y-2">
                      {Object.entries(categoryTotals).map(([cat, val]) => (
                        <div key={cat} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[cat] || ""}`}>
                              {cat}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-foreground">{formatCurrency(val)}</span>
                        </div>
                      ))}
                    </div>
                    <Link href="/assets" className="mt-4 flex items-center gap-1 text-xs text-primary hover:underline">
                      View all assets <ChevronRight className="h-3 w-3" />
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Cash Flow */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <CashFlowCard summary={billSummary} upcomingBills={upcomingBills} />
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-6 lg:col-span-8">
              {/* Quick Stats */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Assets</p>
                      <p className="text-2xl font-bold text-foreground">{assets.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Due This Month</p>
                      <p className="text-2xl font-bold text-foreground">
                        {billSummary ? `$${Math.round(billSummary.totalDueThisMonth / 100).toLocaleString()}` : "\u2014"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Pending Bills</p>
                      <p className="text-2xl font-bold text-foreground">{billSummary?.upcomingCount || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Messages</p>
                      <p className="text-2xl font-bold text-foreground">{messages.length}</p>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>

              {/* Asset List */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4 text-primary" />
                        Assets
                      </CardTitle>
                      <Link href="/assets" className="text-xs text-primary hover:underline">
                        View all \u2192
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {assets.slice(0, 6).map((asset) => (
                        <Link
                          key={asset.id}
                          href={`/assets/${asset.id}`}
                          className="flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize ${categoryColors[asset.category] || ""}`}>
                              {asset.category}
                            </div>
                            <span className="text-sm font-medium text-foreground">{asset.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatCurrency(asset.estimated_value)}</span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Messages */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Recent Messages
                      </CardTitle>
                      <Link href="/messages" className="text-xs text-primary hover:underline">
                        View all \u2192
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No messages yet</p>
                    ) : (
                      <div className="space-y-2">
                        {messages.map((msg) => (
                          <Link
                            key={msg.id}
                            href="/messages"
                            className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/30"
                          >
                            <div className="mt-0.5">{typeIcons[msg.type]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{msg.title}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] ${priorityColors[msg.priority]}`}>
                                  {msg.priority}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground capitalize">{msg.type.replace("_", " ")}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </motion.main>
    </div>
  );
}
