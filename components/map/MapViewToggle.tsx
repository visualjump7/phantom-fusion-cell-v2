"use client";

import { Layers } from "lucide-react";
import type { MapStyleKey, MapProjectionKey } from "./GlobeMap";

interface MapViewToggleProps {
  projection: MapProjectionKey;
  onProjectionChange: (projection: MapProjectionKey) => void;
  mapStyle: MapStyleKey;
  onMapStyleChange: (style: MapStyleKey) => void;
  /** "sm" is used on the embedded standard-view map, "md" on the immersive globe */
  size?: "sm" | "md";
  className?: string;
}

const STYLE_OPTIONS_3D: { key: MapStyleKey; label: string }[] = [
  { key: "dark", label: "Dark" },
  { key: "satellite", label: "Satellite" },
];

const STYLE_OPTIONS_2D: { key: MapStyleKey; label: string }[] = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
];

export function MapViewToggle({
  projection,
  onProjectionChange,
  mapStyle,
  onMapStyleChange,
  size = "md",
  className = "",
}: MapViewToggleProps) {
  const styleOptions =
    projection === "3D" ? STYLE_OPTIONS_3D : STYLE_OPTIONS_2D;

  // Size-aware class sets
  const pillPadY = size === "sm" ? "py-[3px]" : "p-0.5";
  const pillGap = size === "sm" ? "gap-1" : "gap-1.5";
  const btnPad = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const btnText = size === "sm" ? "text-[9px]" : "text-[10px]";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3 w-3";

  return (
    <div className={`flex flex-col items-end ${pillGap} ${className}`}>
      {/* Tier 1: Projection (3D / 2D) */}
      <div
        className={`flex items-center gap-0.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md ${pillPadY} px-0.5 pointer-events-auto`}
      >
        <Layers className={`${iconSize} text-white/50 ml-1.5 mr-1`} />
        {(["3D", "2D"] as MapProjectionKey[]).map((key) => (
          <button
            key={key}
            onClick={() => onProjectionChange(key)}
            className={`rounded-full ${btnPad} ${btnText} font-medium transition-colors ${
              projection === key
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Tier 2: Style (depends on projection) */}
      <div
        className={`flex items-center gap-0.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md ${pillPadY} px-0.5 pointer-events-auto`}
      >
        {styleOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onMapStyleChange(opt.key)}
            className={`rounded-full ${btnPad} ${btnText} font-medium transition-colors ${
              mapStyle === opt.key
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
