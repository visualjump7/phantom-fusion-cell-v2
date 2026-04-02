"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { GlassCard } from "./GlassCard";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

/* ────────────────── Types ────────────────── */

export type ExpandedCard = "holdings" | "alerts" | "cashflow" | null;
export type AlertFilter =
  | "urgent"
  | "decisions"
  | "high"
  | "medium"
  | null;

interface AlertCounts {
  urgent: number;
  high: number;
  medium: number;
  decisions: number;
}

export interface PanelMessage {
  id: string;
  title: string;
  type: string;
  priority: string;
  asset_id: string | null;
  created_at: string;
  asset_name?: string;
}

export interface PanelBill {
  id: string;
  title: string;
  amount_cents: number;
  due_date: string;
  status: string;
  asset_id?: string | null;
  asset_name?: string;
}

export interface PanelAsset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
  hasLocation: boolean;
}

interface LeftStatPanelProps {
  totalValue: number;
  assetCount: number;
  alerts: AlertCounts;
  monthlyOutflow: number;
  pendingBillCount: number;
  /** Full message list for expansion */
  allMessages: PanelMessage[];
  /** Full bill list for expansion */
  allBills: PanelBill[];
  /** Asset list for holdings expansion */
  allAssets: PanelAsset[];
  /** Which card is expanded */
  expandedCard: ExpandedCard;
  onExpandCard: (card: ExpandedCard) => void;
  /** Active alert sub-filter */
  alertFilter: AlertFilter;
  onAlertFilter: (filter: AlertFilter) => void;
  /** Click a specific asset (fly + drill-down) */
  onAssetClick: (assetId: string) => void;
}

/* ────────────────── Constants ────────────────── */

const ALERT_CATEGORIES: {
  key: AlertFilter;
  label: string;
  dotClass: string;
  dotColor: string;
  filter: (m: PanelMessage) => boolean;
}[] = [
  {
    key: "urgent",
    label: "Urgent",
    dotClass: "bg-red-500",
    dotColor: "#ef4444",
    filter: (m) => m.priority === "urgent",
  },
  {
    key: "decisions",
    label: "Decisions Pending",
    dotClass: "bg-amber-500",
    dotColor: "#f59e0b",
    filter: (m) => m.type === "decision",
  },
  {
    key: "high",
    label: "High Priority",
    dotClass: "bg-orange-400",
    dotColor: "#fb923c",
    filter: (m) => m.priority === "high",
  },
  {
    key: "medium",
    label: "Updates",
    dotClass: "bg-blue-400",
    dotColor: "#60a5fa",
    filter: (m) => m.priority === "medium",
  },
];

const CATEGORY_BADGE: Record<string, string> = {
  business: "bg-blue-600 text-white",
  family: "bg-emerald-600 text-white",
  personal: "bg-violet-600 text-white",
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ────────────────── Animations ────────────────── */

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.2, delayChildren: 0.5 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: -40 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

/* ────────────────── Component ────────────────── */

export function LeftStatPanel({
  totalValue,
  assetCount,
  alerts,
  monthlyOutflow,
  pendingBillCount,
  allMessages,
  allBills,
  allAssets,
  expandedCard,
  onExpandCard,
  alertFilter,
  onAlertFilter,
  onAssetClick,
}: LeftStatPanelProps) {
  const isExpanded = (card: ExpandedCard) => expandedCard === card;

  const toggleCard = (card: NonNullable<ExpandedCard>) => {
    if (expandedCard === card) {
      onExpandCard(null);
      if (card === "alerts") onAlertFilter(null);
    } else {
      onExpandCard(card);
      if (card !== "alerts") onAlertFilter(null);
    }
  };

  // Derive filtered messages for the active alert sub-filter
  const alertCategory = ALERT_CATEGORIES.find((c) => c.key === alertFilter);
  const filteredMessages = alertCategory
    ? allMessages.filter(alertCategory.filter).slice(0, 5)
    : [];
  const totalFiltered = alertCategory
    ? allMessages.filter(alertCategory.filter).length
    : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="absolute left-6 top-24 pointer-events-none hidden xl:flex flex-col gap-4 w-[200px] 2xl:w-[240px]"
    >
      {/* ─── Total Holdings ─── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
          <button
            onClick={() => toggleCard("holdings")}
            className="w-full text-left group"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                Total Holdings
              </span>
              <ChevronRight
                className={`h-3 w-3 text-white/30 ml-auto transition-transform duration-200 ${
                  isExpanded("holdings") ? "rotate-90" : ""
                }`}
              />
            </div>
            <p className="text-xl 2xl:text-2xl font-semibold text-white">
              {formatCurrency(totalValue)}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {assetCount} project{assetCount !== 1 ? "s" : ""}
            </p>
          </button>

          {/* Expanded: asset list */}
          <AnimatePresence>
            {isExpanded("holdings") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                  <motion.div
                    initial="hidden"
                    animate="show"
                    transition={{ staggerChildren: 0.05 }}
                  >
                    {allAssets.slice(0, 8).map((asset) => (
                      <motion.button
                        key={asset.id}
                        variants={rowVariants}
                        onClick={() => onAssetClick(asset.id)}
                        className="flex items-center justify-between w-full text-left rounded-md px-2 py-1.5 hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="text-[11px] text-white/80 truncate">
                            {asset.name}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`rounded px-1 py-0 text-[8px] font-medium capitalize ${
                                CATEGORY_BADGE[asset.category] || "bg-gray-600 text-white"
                              }`}
                            >
                              {asset.category}
                            </span>
                            {!asset.hasLocation && (
                              <span className="text-[8px] text-white/30">
                                (no location)
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-white/50 whitespace-nowrap">
                          {formatCurrency(asset.estimated_value)}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                  {allAssets.length > 8 && (
                    <Link
                      href="/assets"
                      className="block text-[10px] text-white/40 hover:text-white/70 text-center pt-1 transition-colors"
                    >
                      View all {allAssets.length} &rarr;
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ─── Alerts ─── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
          <button
            onClick={() => toggleCard("alerts")}
            className="w-full text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                Alerts
              </span>
              <ChevronRight
                className={`h-3 w-3 text-white/30 ml-auto transition-transform duration-200 ${
                  isExpanded("alerts") ? "rotate-90" : ""
                }`}
              />
            </div>
          </button>

          <div className="space-y-1">
            {ALERT_CATEGORIES.map((cat) => {
              const count =
                cat.key === "urgent"
                  ? alerts.urgent
                  : cat.key === "decisions"
                    ? alerts.decisions
                    : cat.key === "high"
                      ? alerts.high
                      : alerts.medium;
              if (count === 0) return null;

              const isActive = alertFilter === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    if (!isExpanded("alerts")) onExpandCard("alerts");
                    onAlertFilter(isActive ? null : cat.key);
                  }}
                  className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-white/10 scale-[1.02]"
                      : "hover:bg-white/5 hover:scale-[1.02]"
                  } ${
                    alertFilter && !isActive ? "opacity-40" : "opacity-100"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${cat.dotClass} transition-shadow duration-200`}
                    style={
                      isActive
                        ? { boxShadow: `0 0 6px ${cat.dotColor}, 0 0 12px ${cat.dotColor}40` }
                        : undefined
                    }
                  />
                  <span className="text-xs text-white/80">
                    {count} {cat.label}
                  </span>
                </button>
              );
            })}
            {alerts.urgent === 0 &&
              alerts.high === 0 &&
              alerts.decisions === 0 &&
              alerts.medium === 0 && (
                <p className="text-xs text-white/40 italic px-2">
                  No active alerts
                </p>
              )}
          </div>

          {/* Expanded: individual messages for active filter */}
          <AnimatePresence>
            {isExpanded("alerts") && alertFilter && filteredMessages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  <motion.div
                    initial="hidden"
                    animate="show"
                    transition={{ staggerChildren: 0.05 }}
                  >
                    {filteredMessages.map((msg) => (
                      <motion.button
                        key={msg.id}
                        variants={rowVariants}
                        onClick={() =>
                          msg.asset_id && onAssetClick(msg.asset_id)
                        }
                        disabled={!msg.asset_id}
                        className="flex items-start gap-2 w-full text-left rounded-md px-2 py-1.5 hover:bg-white/10 active:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-white/80 truncate">
                            {msg.title.length > 40
                              ? msg.title.slice(0, 40) + "\u2026"
                              : msg.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {msg.asset_name && (
                              <span className="text-[9px] text-white/40 truncate max-w-[100px]">
                                {msg.asset_name}
                              </span>
                            )}
                            <span className="text-[9px] text-white/30">
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                  {totalFiltered > 5 && (
                    <Link
                      href="/messages"
                      className="block text-[10px] text-white/40 hover:text-white/70 text-center pt-1 transition-colors"
                    >
                      View all {totalFiltered} &rarr;
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* ─── Cash Flow ─── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
          <button
            onClick={() => toggleCard("cashflow")}
            className="w-full text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                Monthly Outflow
              </span>
              <ChevronRight
                className={`h-3 w-3 text-white/30 ml-auto transition-transform duration-200 ${
                  isExpanded("cashflow") ? "rotate-90" : ""
                }`}
              />
            </div>
            <p className="text-xl 2xl:text-2xl font-semibold text-white">
              {formatCurrency(monthlyOutflow / 100)}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {pendingBillCount} pending bill
              {pendingBillCount !== 1 ? "s" : ""}
            </p>
          </button>

          {/* Expanded: upcoming bills */}
          <AnimatePresence>
            {isExpanded("cashflow") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                  <motion.div
                    initial="hidden"
                    animate="show"
                    transition={{ staggerChildren: 0.05 }}
                  >
                    {allBills.slice(0, 5).map((bill) => (
                      <motion.button
                        key={bill.id}
                        variants={rowVariants}
                        onClick={() =>
                          bill.asset_id && onAssetClick(bill.asset_id)
                        }
                        disabled={!bill.asset_id}
                        className="flex items-center justify-between w-full text-left rounded-md px-2 py-1.5 hover:bg-white/10 active:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-default cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="text-[11px] text-white/80 truncate">
                            {bill.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {bill.asset_name && (
                              <span className="text-[9px] text-white/40 truncate max-w-[80px]">
                                {bill.asset_name}
                              </span>
                            )}
                            <span className="text-[9px] text-white/30">
                              Due{" "}
                              {new Date(
                                bill.due_date + "T00:00:00"
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-white/50 whitespace-nowrap">
                          {formatCurrency(bill.amount_cents / 100)}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                  {allBills.length > 5 && (
                    <Link
                      href="/cash-flow"
                      className="block text-[10px] text-white/40 hover:text-white/70 text-center pt-1 transition-colors"
                    >
                      View all {allBills.length} &rarr;
                    </Link>
                  )}
                  {allBills.length === 0 && (
                    <p className="text-[10px] text-white/30 italic text-center py-1">
                      No upcoming bills
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
