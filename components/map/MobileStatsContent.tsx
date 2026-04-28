"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Globe,
  Bell,
  PieChart,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  ExpandedCard,
  AlertFilter,
  PanelMessage,
  PanelBill,
  PanelAsset,
} from "./LeftStatPanel";
import Link from "next/link";

interface AlertCounts {
  urgent: number;
  high: number;
  medium: number;
  decisions: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  value: number;
}

interface CountryBreakdown {
  code: string;
  count: number;
  value: number;
}

interface RecentMessage {
  id: string;
  title: string;
  priority: string;
  created_at: string;
  asset_id: string | null;
}

interface MobileStatsContentProps {
  totalValue: number;
  assetCount: number;
  locatedCount: number;
  alerts: AlertCounts;
  monthlyOutflow: number;
  pendingBillCount: number;
  /** Globe stats block (mobile only) */
  pendingBillTotal: number;
  decisionCount: number;
  categories: CategoryBreakdown[];
  countries: CountryBreakdown[];
  recentMessages: RecentMessage[];
  activeFilter: string | null;
  onCategoryFilter: (category: string | null) => void;
  onCountryZoom: (code: string) => void;
  onAlertClick: (assetId: string) => void;
  /** Interactive card props */
  allMessages: PanelMessage[];
  allBills: PanelBill[];
  allAssets: PanelAsset[];
  alertFilter: AlertFilter;
  onAlertFilter: (filter: AlertFilter) => void;
  expandedCard: ExpandedCard;
  onExpandCard: (card: ExpandedCard) => void;
  onAssetClick: (assetId: string) => void;
  onMessageClick?: (msg: PanelMessage) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  business: "#3b82f6",
  family: "#10b981",
  personal: "#8b5cf6",
};

const CATEGORY_BADGE: Record<string, string> = {
  business: "bg-blue-600 text-white",
  family: "bg-emerald-600 text-white",
  personal: "bg-violet-600 text-white",
};

const FLAG_EMOJI: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}",
  GB: "\u{1F1EC}\u{1F1E7}",
  CA: "\u{1F1E8}\u{1F1E6}",
  DE: "\u{1F1E9}\u{1F1EA}",
  FR: "\u{1F1EB}\u{1F1F7}",
  CH: "\u{1F1E8}\u{1F1ED}",
  SG: "\u{1F1F8}\u{1F1EC}",
  AE: "\u{1F1E6}\u{1F1EA}",
  JP: "\u{1F1EF}\u{1F1F5}",
  AU: "\u{1F1E6}\u{1F1FA}",
  IN: "\u{1F1EE}\u{1F1F3}",
  HK: "\u{1F1ED}\u{1F1F0}",
  NL: "\u{1F1F3}\u{1F1F1}",
  IE: "\u{1F1EE}\u{1F1EA}",
  BR: "\u{1F1E7}\u{1F1F7}",
  MX: "\u{1F1F2}\u{1F1FD}",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-white/30",
};

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

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function MobileStatsContent({
  totalValue,
  assetCount,
  locatedCount,
  alerts,
  monthlyOutflow,
  pendingBillCount,
  pendingBillTotal,
  decisionCount,
  categories,
  countries,
  recentMessages,
  activeFilter,
  onCategoryFilter,
  onCountryZoom,
  onAlertClick,
  allMessages,
  allBills,
  allAssets,
  alertFilter,
  onAlertFilter,
  expandedCard,
  onExpandCard,
  onAssetClick,
  onMessageClick,
}: MobileStatsContentProps) {
  const totalCatValue = categories.reduce((s, c) => s + c.value, 0);

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

  // Derive filtered messages for alert sub-filter
  const alertCategory = ALERT_CATEGORIES.find((c) => c.key === alertFilter);
  const filteredMessages = alertCategory
    ? allMessages.filter(alertCategory.filter).slice(0, 5)
    : [];
  const totalFiltered = alertCategory
    ? allMessages.filter(alertCategory.filter).length
    : 0;

  return (
    <div className="flex flex-col gap-2 md:gap-3 overflow-visible">
      {/* Collapsed summary */}
      <p className="order-0 text-sm text-white/70 text-center py-1">
        {locatedCount} holding{locatedCount !== 1 ? "s" : ""}
        {" \u2022 "}
        {countries.length} countr{countries.length !== 1 ? "ies" : "y"}
        {" \u2022 "}
        <span className="text-white font-medium">
          {formatCurrency(totalValue)}
        </span>
      </p>

      {/* ─── Summary (clickable) ─── */}
      <div className="order-1 md:order-1 rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
        <button
          onClick={() => toggleCard("holdings")}
          className="w-full text-left"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
              Summary
            </span>
            <ChevronRight
              className={`h-3 w-3 text-white/30 ml-auto transition-transform duration-200 ${
                isExpanded("holdings") ? "rotate-90" : ""
              }`}
            />
          </div>
          <p className="text-2xl font-semibold text-white">
            {formatCurrency(totalValue)}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
            <span>{assetCount} projects</span>
            <span>
              {locatedCount} mapped &middot;{" "}
              {assetCount - locatedCount} unlocated
            </span>
          </div>
        </button>

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
                      className="flex items-center justify-between w-full text-left rounded-md px-2 py-2 active:bg-white/10 transition-colors"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="text-[11px] text-white/80 truncate">
                          {asset.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`rounded px-1 py-0 text-[8px] font-medium capitalize ${
                              CATEGORY_BADGE[asset.category] ||
                              "bg-gray-600 text-white"
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
                    className="block text-[10px] text-white/40 text-center pt-1"
                  >
                    View all {allAssets.length} &rarr;
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Alerts (clickable) — hidden on mobile, visible md+ ─── */}
      <div className="hidden md:block md:order-2 rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
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
                className={`flex items-center gap-2 w-full rounded-md px-2 py-2 transition-all duration-200 ${
                  isActive
                    ? "bg-white/10 scale-[1.02]"
                    : "active:bg-white/10"
                } ${alertFilter && !isActive ? "opacity-40" : "opacity-100"}`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${cat.dotClass} transition-shadow duration-200`}
                  style={
                    isActive
                      ? {
                          boxShadow: `0 0 6px ${cat.dotColor}, 0 0 12px ${cat.dotColor}40`,
                        }
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

        <AnimatePresence>
          {isExpanded("alerts") &&
            alertFilter &&
            filteredMessages.length > 0 && (
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
                        onClick={() => {
                          if (msg.type === "decision" && onMessageClick) {
                            onMessageClick(msg);
                          } else if (msg.asset_id) {
                            onAssetClick(msg.asset_id);
                          }
                        }}
                        disabled={
                          msg.type !== "decision" && !msg.asset_id
                        }
                        className="flex items-start gap-2 w-full text-left rounded-md px-2 py-2 active:bg-white/10 transition-colors disabled:opacity-40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-white/80 truncate">
                            {msg.title.length > 40
                              ? msg.title.slice(0, 40) + "\u2026"
                              : msg.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {msg.asset_name && (
                              <span className="text-[9px] text-white/40 truncate max-w-[120px]">
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
                      href="/comms/alerts"
                      className="block text-[10px] text-white/40 text-center pt-1"
                    >
                      View all {totalFiltered} &rarr;
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* ─── Monthly Outflow (clickable) ─── */}
      <div className="order-3 md:order-3 rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
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
          <p className="text-xl font-semibold text-white">
            {formatCurrency(monthlyOutflow / 100)}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {pendingBillCount} pending bill
            {pendingBillCount !== 1 ? "s" : ""}
          </p>
        </button>

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
                      className="flex items-center justify-between w-full text-left rounded-md px-2 py-2 active:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="text-[11px] text-white/80 truncate">
                          {bill.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {bill.asset_name && (
                            <span className="text-[9px] text-white/40 truncate max-w-[100px]">
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
                    className="block text-[10px] text-white/40 text-center pt-1"
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
      </div>

      {/* Geographic Distribution */}
      {countries.length > 0 && (
        <div className="order-2 md:order-4 rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
              Geography
            </span>
          </div>
          <div className="space-y-1.5">
            {countries.map((c) => (
              <button
                key={c.code}
                onClick={() => onCountryZoom(c.code)}
                className="flex items-center justify-between w-full text-xs rounded-md px-2 py-2 active:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {FLAG_EMOJI[c.code] || "\u{1F30D}"}
                  </span>
                  <span className="text-white/80">{c.code}</span>
                </div>
                <span className="text-white/50">
                  {c.count} &middot; {formatCurrency(c.value)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentMessages.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
              Recent Activity
            </span>
          </div>
          <div className="space-y-2">
            {recentMessages.slice(0, 5).map((msg) => (
              <button
                key={msg.id}
                onClick={() => msg.asset_id && onAlertClick(msg.asset_id)}
                disabled={!msg.asset_id}
                className="flex items-start gap-2 w-full text-left rounded-md px-2 py-2 active:bg-white/10 transition-colors disabled:opacity-50"
              >
                <div
                  className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                    PRIORITY_COLORS[msg.priority] || "bg-white/30"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/80 truncate">
                    {msg.title}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {timeAgo(msg.created_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* By Category — hidden below md (mobile). Still visible on tablet (md+). */}
      <div className="hidden md:block md:order-5 rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
            By Category
          </span>
        </div>
        {totalCatValue > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {categories.map((cat) => {
              const pct = (cat.value / totalCatValue) * 100;
              if (pct < 1) return null;
              return (
                <button
                  key={cat.category}
                  onClick={() =>
                    onCategoryFilter(
                      activeFilter === cat.category ? null : cat.category
                    )
                  }
                  className="transition-opacity"
                  style={{
                    width: `${pct}%`,
                    backgroundColor:
                      CATEGORY_COLORS[cat.category] || "#666",
                    opacity:
                      activeFilter && activeFilter !== cat.category
                        ? 0.3
                        : 1,
                  }}
                />
              );
            })}
          </div>
        )}
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() =>
                onCategoryFilter(
                  activeFilter === cat.category ? null : cat.category
                )
              }
              className={`flex items-center justify-between w-full text-xs rounded-md px-2 py-2 transition-colors ${
                activeFilter === cat.category
                  ? "bg-white/10"
                  : "active:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[cat.category] || "#666",
                  }}
                />
                <span className="text-white/80 capitalize">
                  {cat.category}
                </span>
              </div>
              <span className="text-white/50">
                {cat.count} &middot; {formatCurrency(cat.value)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Globe Stats (Projects Mapped / Pending Bills / Decisions) — mobile only */}
      <div className="order-4 md:hidden rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="flex items-stretch justify-between gap-2 divide-x divide-white/10">
          <div className="flex-1 text-center px-1">
            <p className="text-[9px] text-white/50 uppercase tracking-wider whitespace-nowrap">
              Projects Mapped
            </p>
            <p className="text-sm font-semibold text-white whitespace-nowrap mt-0.5">
              {locatedCount}/{assetCount}
            </p>
          </div>
          <div className="flex-1 text-center px-1">
            <p className="text-[9px] text-white/50 uppercase tracking-wider whitespace-nowrap">
              Pending Bills
            </p>
            <p className="text-sm font-semibold text-white whitespace-nowrap mt-0.5">
              {formatCurrency(pendingBillTotal / 100)}
            </p>
          </div>
          <div className="flex-1 text-center px-1">
            <p className="text-[9px] text-white/50 uppercase tracking-wider whitespace-nowrap">
              Decisions
            </p>
            <p className="text-sm font-semibold text-white whitespace-nowrap mt-0.5">
              {decisionCount > 0 ? `${decisionCount} awaiting` : "None"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
