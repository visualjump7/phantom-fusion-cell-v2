"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, MapPinOff } from "lucide-react";
import { UnlocatedAsset } from "@/lib/map-types";
import { Badge } from "@/components/ui/badge";
import { getCategoryColor } from "@/lib/utils";

interface UnlocatedListProps {
  assets: UnlocatedAsset[];
  onSelect: (assetId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function UnlocatedList({ assets, onSelect, isOpen, onToggle }: UnlocatedListProps) {
  if (assets.length === 0) return null;

  return (
    <div className="absolute bottom-14 left-4 z-20 w-64">
      <div className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-md text-white overflow-hidden">
        {/* Header */}
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MapPinOff className="h-3.5 w-3.5 text-white/60" />
            <span>Unlocated Projects</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
              {assets.length}
            </span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/60" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-white/60" />
          )}
        </button>

        {/* Expanded list */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/10 max-h-48 overflow-y-auto">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelect(asset.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${getCategoryColor(asset.category)}`}
                    >
                      {asset.category}
                    </Badge>
                    <span className="truncate text-white/80">{asset.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
