"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Globe, Bell } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { formatCurrency } from "@/lib/utils";

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

interface RightStatPanelProps {
  categories: CategoryBreakdown[];
  countries: CountryBreakdown[];
  recentMessages: RecentMessage[];
  activeFilter: string | null;
  onCategoryFilter: (category: string | null) => void;
  onCountryZoom: (code: string) => void;
  onAlertClick: (assetId: string) => void;
  visible: boolean;
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

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-white/30",
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

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.2, delayChildren: 0.5 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: 40 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export function RightStatPanel({
  categories,
  countries,
  recentMessages,
  activeFilter,
  onCategoryFilter,
  onCountryZoom,
  onAlertClick,
  visible,
}: RightStatPanelProps) {
  const totalValue = categories.reduce((s, c) => s + c.value, 0);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
          className="absolute right-6 top-24 pointer-events-none hidden xl:flex flex-col gap-4 w-[200px] 2xl:w-[260px]"
        >
          {/* Holdings by Category */}
          <motion.div variants={cardVariants}>
            <GlassCard className="p-3 2xl:p-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                  By Category
                </span>
              </div>
              {/* Stacked bar */}
              {totalValue > 0 && (
                <div className="flex h-3 rounded-full overflow-hidden mb-3">
                  {categories.map((cat) => {
                    const pct = (cat.value / totalValue) * 100;
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
                        activeFilter === cat.category ? null : cat.category
                      )
                    }
                    className={`flex items-center justify-between w-full text-xs rounded-md px-2 py-1 transition-colors ${
                      activeFilter === cat.category
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

          {/* Geographic Distribution */}
          {countries.length > 0 && (
            <motion.div variants={cardVariants}>
              <GlassCard className="p-3 2xl:p-4">
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

          {/* Recent Activity */}
          {recentMessages.length > 0 && (
            <motion.div variants={cardVariants}>
              <GlassCard className="p-3 2xl:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                    Recent Activity
                  </span>
                </div>
                <div className="space-y-2">
                  {recentMessages.slice(0, 4).map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => msg.asset_id && onAlertClick(msg.asset_id)}
                      disabled={!msg.asset_id}
                      className="flex items-start gap-2 w-full text-left rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors disabled:opacity-50"
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
              </GlassCard>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
