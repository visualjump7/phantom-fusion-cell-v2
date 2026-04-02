"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface MapPinProps {
  color: string;
  isSelected: boolean;
  isApproximate: boolean;
  value?: number;
  name: string;
  onClick: () => void;
  dimmed?: boolean;
  isMobile?: boolean;
  /** When set, renders a colored ring around the pin to highlight it */
  highlightColor?: string | null;
}

export function MapPin({
  color,
  isSelected,
  isApproximate,
  value,
  name,
  onClick,
  dimmed = false,
  isMobile = false,
  highlightColor = null,
}: MapPinProps) {
  const [hovered, setHovered] = useState(false);

  // Sizes scale up on mobile for touch friendliness
  const touchSize = isMobile ? 48 : 36;
  const dotSize = isMobile ? 16 : 12;
  const pulseSize = isMobile ? 36 : 28;
  const glowSize = isMobile ? 26 : 20;
  const ringSize = isMobile ? 32 : 24;

  return (
    <div
      className="relative cursor-pointer transition-opacity duration-300 flex items-center justify-center"
      style={{ opacity: dimmed ? 0.2 : 1, width: touchSize, height: touchSize }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip on hover — hidden on mobile (no hover state) */}
      {!isMobile && hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 whitespace-nowrap z-50 pointer-events-none">
          <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-center">
            <p className="text-xs font-semibold text-foreground">{name}</p>
            {value != null && value > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatCurrency(value)}
              </p>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 border-r border-b border-border bg-card" />
        </div>
      )}

      {/* Highlight ring — visible when highlightColor is set */}
      {highlightColor && (
        <div
          className="absolute rounded-full map-pin-pulse"
          style={{
            width: ringSize,
            height: ringSize,
            top: (touchSize - ringSize) / 2,
            left: (touchSize - ringSize) / 2,
            border: `2px solid ${highlightColor}`,
            boxShadow: `0 0 8px ${highlightColor}, 0 0 16px ${highlightColor}40`,
            transformOrigin: "center",
          }}
        />
      )}

      {/* Pulse ring — centered in container */}
      <div
        className={`absolute rounded-full ${dimmed ? "" : "map-pin-pulse"}`}
        style={{
          width: pulseSize,
          height: pulseSize,
          top: (touchSize - pulseSize) / 2,
          left: (touchSize - pulseSize) / 2,
          backgroundColor: color,
          opacity: 0.3,
          transformOrigin: "center",
        }}
      />

      {/* Middle glow ring — centered */}
      <div
        className="absolute rounded-full"
        style={{
          width: glowSize,
          height: glowSize,
          top: (touchSize - glowSize) / 2,
          left: (touchSize - glowSize) / 2,
          backgroundColor: color,
          opacity: 0.2,
        }}
      />

      {/* Inner dot / ring — centered via flexbox parent */}
      {isApproximate ? (
        <div
          className={`rounded-full transition-transform duration-200 ${isSelected ? "map-pin-selected" : ""}`}
          style={{
            width: dotSize,
            height: dotSize,
            border: `2px solid ${color}`,
            backgroundColor: "transparent",
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ) : (
        <div
          className={`rounded-full transition-transform duration-200 ${isSelected ? "map-pin-selected" : ""}`}
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}, 0 0 16px ${color}40`,
          }}
        />
      )}
    </div>
  );
}
