"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "./GlassCard";
import {
  ExpandedCard,
  AlertFilter,
  PanelMessage,
} from "./LeftStatPanel";

interface AlertCounts {
  urgent: number;
  high: number;
  medium: number;
  decisions: number;
}

interface AlertsCardProps {
  alerts: AlertCounts;
  allMessages: PanelMessage[];
  expandedCard: ExpandedCard;
  onExpandCard: (card: ExpandedCard) => void;
  alertFilter: AlertFilter;
  onAlertFilter: (filter: AlertFilter) => void;
  onAssetClick: (assetId: string) => void;
  onMessageClick?: (msg: PanelMessage) => void;
}

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

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
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

export function AlertsCard({
  alerts,
  allMessages,
  expandedCard,
  onExpandCard,
  alertFilter,
  onAlertFilter,
  onAssetClick,
  onMessageClick,
}: AlertsCardProps) {
  const isExpanded = expandedCard === "alerts";

  const toggleCard = () => {
    if (expandedCard === "alerts") {
      onExpandCard(null);
      onAlertFilter(null);
    } else {
      onExpandCard("alerts");
    }
  };

  const alertCategory = ALERT_CATEGORIES.find((c) => c.key === alertFilter);
  const filteredMessages = alertCategory
    ? allMessages.filter(alertCategory.filter).slice(0, 5)
    : [];
  const totalFiltered = alertCategory
    ? allMessages.filter(alertCategory.filter).length
    : 0;

  return (
    <GlassCard className="p-3 2xl:p-4 shrink-0">
      <button onClick={toggleCard} className="w-full text-left">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
            Alerts
          </span>
          <ChevronRight
            className={`h-3 w-3 text-white/30 ml-auto transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
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
                if (!isExpanded) onExpandCard("alerts");
                onAlertFilter(isActive ? null : cat.key);
              }}
              className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-white/10 scale-[1.02]"
                  : "hover:bg-white/5 hover:scale-[1.02]"
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
            <p className="text-xs text-white/40 italic px-2">No active alerts</p>
          )}
      </div>

      <AnimatePresence>
        {isExpanded && alertFilter && filteredMessages.length > 0 && (
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
                    disabled={msg.type !== "decision" && !msg.asset_id}
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
                  href="/comms/alerts"
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
  );
}
