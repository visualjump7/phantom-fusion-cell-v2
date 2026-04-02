"use client";

import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { formatCurrency } from "@/lib/utils";

interface ImmersiveBottomBarProps {
  locatedCount: number;
  totalCount: number;
  pendingBillTotal: number;
  decisionCount: number;
  nextDueDate: string | null;
  nextDueAmount: number;
}

export function ImmersiveBottomBar({
  locatedCount,
  totalCount,
  pendingBillTotal,
  decisionCount,
  nextDueDate,
  nextDueAmount,
}: ImmersiveBottomBarProps) {
  const cells = [
    {
      label: "Holdings Mapped",
      value: `${locatedCount}/${totalCount}`,
    },
    {
      label: "Pending Bills",
      value: formatCurrency(pendingBillTotal / 100),
    },
    {
      label: "Decisions",
      value: decisionCount > 0 ? `${decisionCount} awaiting` : "None",
    },
    ...(nextDueDate
      ? [
          {
            label: `Next Due: ${new Date(nextDueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            value: formatCurrency(nextDueAmount / 100),
          },
        ]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
    >
      <GlassCard className="px-2 py-2">
        <div className="flex items-center divide-x divide-white/10">
          {cells.map((cell, i) => (
            <div key={i} className="px-5 py-1 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wider whitespace-nowrap">
                {cell.label}
              </p>
              <p className="text-sm font-semibold text-white whitespace-nowrap mt-0.5">
                {cell.value}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
