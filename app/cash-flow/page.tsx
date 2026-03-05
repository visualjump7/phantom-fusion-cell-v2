"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, Loader2, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CashFlowHeader } from "@/components/cashflow/CashFlowHeader";
import { BalanceChart } from "@/components/cashflow/BalanceChart";
import { CalendarView } from "@/components/cashflow/CalendarView";
import { MonthlyTable } from "@/components/cashflow/MonthlyTable";
import { TransactionFeed } from "@/components/cashflow/TransactionFeed";
import { CashFlowData, generateDemoCashFlowData } from "@/lib/cashflow";
import { useThemePreferences } from "@/components/ThemeProvider";

type ViewTab = "calendar" | "chart" | "monthly" | "transactions";

const VIEW_TABS: { value: ViewTab; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "calendar", label: "Calendar" },
  { value: "chart", label: "Chart" },
  { value: "transactions", label: "Transactions" },
];

export default function CashFlowPage() {
  const [activeView, setActiveView] = useState<ViewTab>("monthly");
  const [data, setData] = useState<CashFlowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useThemePreferences();

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/cashflow");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch {
        setData(generateDemoCashFlowData());
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view") as ViewTab | null;
    if (view && VIEW_TABS.some((t) => t.value === view)) {
      setActiveView(view);
    }
  }, []);

  const handleViewChange = (view: ViewTab) => {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Navbar />

      <div className={(theme === "light" || theme === "hybrid") ? "section-dark" : ""}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="page-title font-bold text-foreground">Cash Flow</h1>
              <p className="text-[length:var(--font-size-body)] text-muted-foreground">
                Your team&apos;s daily cash position and transaction history
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading cash flow data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-foreground font-medium">Your team&apos;s cash flow data is being updated.</p>
            <p className="text-muted-foreground text-sm">Check back shortly.</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <CashFlowHeader data={data} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex gap-2 border-b border-border pb-4">
                {VIEW_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => handleViewChange(tab.value)}
                    className={`rounded-lg px-4 py-2 text-[length:var(--font-size-body)] font-medium transition-colors ${
                      activeView === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeView === "calendar" && <CalendarView cashFlowData={data} />}
              {activeView === "chart" && <BalanceChart entries={data.dailyEntries} defaultRange="90D" />}
              {activeView === "monthly" && <MonthlyTable entries={data.dailyEntries} />}
              {activeView === "transactions" && <TransactionFeed entries={data.dailyEntries} />}
            </motion.div>
          </div>
        ) : null}
      </motion.main>
    </div>
  );
}
