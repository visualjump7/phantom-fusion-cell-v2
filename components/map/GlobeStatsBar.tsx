"use client";

import { AssetPin, UnlocatedAsset } from "@/lib/map-types";
import { formatCurrency } from "@/lib/utils";
import { MapPin as MapPinIcon, MapPinOff } from "lucide-react";

interface GlobeStatsBarProps {
  locatedAssets: AssetPin[];
  unlocatedAssets: UnlocatedAsset[];
  onShowUnlocated?: () => void;
}

export function GlobeStatsBar({ locatedAssets, unlocatedAssets, onShowUnlocated }: GlobeStatsBarProps) {
  const totalValue = [...locatedAssets, ...unlocatedAssets].reduce(
    (sum, a) => sum + (a.estimatedValue || 0),
    0
  );

  // Count unique countries
  const countries = new Set(locatedAssets.map((a) => a.country).filter(Boolean));

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-black/60 backdrop-blur-md text-white">
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-primary" />
          <span className="font-medium">
            {locatedAssets.length} project{locatedAssets.length !== 1 ? "s" : ""} mapped
          </span>
          {countries.size > 0 && (
            <span className="text-white/60">
              across {countries.size} countr{countries.size !== 1 ? "ies" : "y"}
            </span>
          )}
        </div>

        {totalValue > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-white/60">&mdash;</span>
            <span className="font-semibold">{formatCurrency(totalValue)}</span>
            <span className="text-white/60">total value</span>
          </div>
        )}
      </div>

      {unlocatedAssets.length > 0 && (
        <button
          onClick={onShowUnlocated}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
        >
          <MapPinOff className="h-3.5 w-3.5" />
          {unlocatedAssets.length} not yet mapped
        </button>
      )}
    </div>
  );
}
