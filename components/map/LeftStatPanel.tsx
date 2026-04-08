"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  PieChart,
  Globe,
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

export interface CategoryBreakdown {
  category: string;
  count: number;
  value: number;
}

export interface CountryBreakdown {
  code: string;
  count: number;
  value: number;
}

interface LeftStatPanelProps {
  totalValue: number;
  assetCount: number;
  monthlyOutflow: number;
  pendingBillCount: number;
  /** Full bill list for expansion */
  allBills: PanelBill[];
  /** Asset list for holdings expansion */
  allAssets: PanelAsset[];
  /** Category breakdown for By Category card */
  categories: CategoryBreakdown[];
  activeCategoryFilter: string | null;
  onCategoryFilter: (category: string | null) => void;
  /** Country breakdown for Geography card */
  countries: CountryBreakdown[];
  onCountryZoom: (code: string) => void;
  /** Which card is expanded */
  expandedCard: ExpandedCard;
  onExpandCard: (card: ExpandedCard) => void;
  /** Click a specific asset (fly + drill-down) */
  onAssetClick: (assetId: string) => void;
  /** Open/closed state for slide-to-collapse */
  isOpen: boolean;
  onToggle: () => void;
  /** Globe stats moved from the immersive bottom bar */
  locatedCount: number;
  pendingBillTotal: number;
  decisionCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  business: "#3b82f6",
  family: "#10b981",
  personal: "#8b5cf6",
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

/* ────────────────── Constants ────────────────── */

const CATEGORY_BADGE: Record<string, string> = {
  business: "bg-blue-600 text-white",
  family: "bg-emerald-600 text-white",
  personal: "bg-violet-600 text-white",
};

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
  monthlyOutflow,
  pendingBillCount,
  allBills,
  allAssets,
  categories,
  activeCategoryFilter,
  onCategoryFilter,
  countries,
  onCountryZoom,
  expandedCard,
  onExpandCard,
  onAssetClick,
  isOpen,
  onToggle,
  locatedCount,
  pendingBillTotal,
  decisionCount,
}: LeftStatPanelProps) {
  const totalCategoryValue = categories.reduce((s, c) => s + c.value, 0);
  const isExpanded = (card: ExpandedCard) => expandedCard === card;

  const toggleCard = (card: NonNullable<ExpandedCard>) => {
    if (expandedCard === card) {
      onExpandCard(null);
    } else {
      onExpandCard(card);
    }
  };

  return (
    <motion.div
      animate={{ x: isOpen ? 0 : -260 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute left-6 top-24 bottom-24 pointer-events-none hidden xl:flex flex-col w-[200px] 2xl:w-[240px]"
    >
      {/* Collapse handle — sits on the RIGHT edge of the left panel */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "Collapse left panel" : "Expand left panel"}
        className="absolute right-[-14px] top-1/2 -translate-y-1/2 z-10 flex h-10 w-2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 pointer-events-auto transition-colors"
      >
        {isOpen ? (
          <ChevronLeft className="h-3 w-3 text-white/80 absolute -right-0.5" />
        ) : (
          <ChevronRight className="h-3 w-3 text-white/80 absolute -right-0.5" />
        )}
      </button>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-1"
      >
      {/* ─── Project Summary ─── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
          <button
            onClick={() => toggleCard("holdings")}
            className="w-full text-left group"
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

      {/* ─── By Category ─── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
              By Category
            </span>
          </div>
          {totalCategoryValue > 0 && (
            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              {categories.map((cat) => {
                const pct = (cat.value / totalCategoryValue) * 100;
                if (pct < 1) return null;
                return (
                  <button
                    key={cat.category}
                    onClick={() =>
                      onCategoryFilter(
                        activeCategoryFilter === cat.category
                          ? null
                          : cat.category
                      )
                    }
                    className="transition-opacity"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: CATEGORY_COLORS[cat.category] || "#666",
                      opacity:
                        activeCategoryFilter &&
                        activeCategoryFilter !== cat.category
                          ? 0.3
                          : 1,
                    }}
                    title={`${cat.category}: ${formatCurrency(cat.value)}`}
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
                    activeCategoryFilter === cat.category ? null : cat.category
                  )
                }
                className={`flex items-center justify-between w-full text-xs rounded-md px-2 py-1 transition-colors ${
                  activeCategoryFilter === cat.category
                    ? "bg-white/10"
                    : "hover:bg-white/5"
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
        </GlassCard>
      </motion.div>

      {/* ─── Geography ─── */}
      {countries.length > 0 && (
        <motion.div variants={cardVariants}>
          <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
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
                  className="flex items-center justify-between w-full text-xs rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors"
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
          </GlassCard>
        </motion.div>
      )}

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

      {/* ─── Globe Stats (Projects Mapped / Pending Bills / Decisions) ─── */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-3 2xl:p-4 pointer-events-auto">
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
        </GlassCard>
      </motion.div>
      </motion.div>
    </motion.div>
  );
}
