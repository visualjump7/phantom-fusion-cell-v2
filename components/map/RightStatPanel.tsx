"use client";

import { motion } from "framer-motion";
import { Bell, ChevronRight, ChevronLeft } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { AlertsCard } from "./AlertsCard";
import {
  ExpandedCard,
  AlertFilter,
  PanelMessage,
} from "./LeftStatPanel";

interface RecentMessage {
  id: string;
  title: string;
  priority: string;
  created_at: string;
  asset_id: string | null;
}

interface AlertCounts {
  urgent: number;
  high: number;
  medium: number;
  decisions: number;
}

interface RightStatPanelProps {
  recentMessages: RecentMessage[];
  onAlertClick: (assetId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  /** Alerts card props */
  alerts: AlertCounts;
  allMessages: PanelMessage[];
  expandedCard: ExpandedCard;
  onExpandCard: (card: ExpandedCard) => void;
  alertFilter: AlertFilter;
  onAlertFilter: (filter: AlertFilter) => void;
  onMessageClick?: (msg: PanelMessage) => void;
}

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

const SLIDE_DISTANCE = 280;

export function RightStatPanel({
  recentMessages,
  onAlertClick,
  isOpen,
  onToggle,
  alerts,
  allMessages,
  expandedCard,
  onExpandCard,
  alertFilter,
  onAlertFilter,
  onMessageClick,
}: RightStatPanelProps) {
  return (
    <motion.div
      animate={{ x: isOpen ? 0 : SLIDE_DISTANCE }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute right-6 top-24 bottom-24 pointer-events-none hidden xl:flex flex-col gap-3 w-[260px] 2xl:w-[300px]"
    >
      {/* Collapse handle — sits on the LEFT edge of the right panel */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "Collapse right panel" : "Expand right panel"}
        className="absolute left-[-14px] top-1/2 -translate-y-1/2 z-10 flex h-10 w-2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 pointer-events-auto transition-colors"
      >
        {isOpen ? (
          <ChevronRight className="h-3 w-3 text-white/80 absolute -left-0.5" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-white/80 absolute -left-0.5" />
        )}
      </button>

      {/* Scrollable card stack */}
      <div className="flex-1 min-h-0 overflow-y-auto pointer-events-auto flex flex-col gap-3 pr-1">
        {/* Alerts */}
        <AlertsCard
          alerts={alerts}
          allMessages={allMessages}
          expandedCard={expandedCard}
          onExpandCard={onExpandCard}
          alertFilter={alertFilter}
          onAlertFilter={onAlertFilter}
          onAssetClick={onAlertClick}
          onMessageClick={onMessageClick}
        />

        {/* Recent Activity */}
        {recentMessages.length > 0 && (
          <GlassCard className="p-3 2xl:p-4 shrink-0">
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
        )}

      </div>
    </motion.div>
  );
}
