"use client";

import { motion } from "framer-motion";
import { Minimize2, Layers } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface FloatingTopBarProps {
  principalName?: string;
  totalValue: number;
  pendingTotal: number;
  mapStyle: "dark" | "satellite";
  onMapStyleChange: (style: "dark" | "satellite") => void;
}

export function FloatingTopBar({
  principalName,
  totalValue,
  pendingTotal,
  mapStyle,
  onMapStyleChange,
}: FloatingTopBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-0 left-0 right-0 z-30 pointer-events-auto"
    >
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left — Logo + principal */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white/90 tracking-wide">
            FUSION CELL
          </span>
          {principalName && (
            <>
              <span className="text-white/30">/</span>
              <span className="text-xs text-white/60">{principalName}</span>
            </>
          )}
        </div>

        {/* Center — Key metrics in glass pills */}
        <div className="hidden md:flex items-center gap-3">
          <div className="rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 text-xs text-white/80">
            Total Holdings:{" "}
            <span className="font-semibold text-white">
              {formatCurrency(totalValue)}
            </span>
          </div>
          {pendingTotal > 0 && (
            <div className="rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 text-xs text-white/80">
              Pending:{" "}
              <span className="font-semibold text-amber-400">
                {formatCurrency(pendingTotal / 100)}
              </span>
            </div>
          )}
        </div>

        {/* Right — Controls */}
        <div className="flex items-center gap-2">
          {/* Map style toggle */}
          <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md p-0.5">
            <Layers className="h-3 w-3 text-white/50 ml-2 mr-1" />
            {(["dark", "satellite"] as const).map((key) => (
              <button
                key={key}
                onClick={() => onMapStyleChange(key)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  mapStyle === key
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {key === "dark" ? "Dark" : "Satellite"}
              </button>
            ))}
          </div>

          {/* Back to standard view */}
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Minimize2 className="h-3 w-3" />
            <span className="hidden sm:inline">Standard View</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
