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
}

export function MapPin({ color, isSelected, isApproximate, value, name, onClick }: MapPinProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip on hover */}
      {hovered && (
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
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 border-r border-b border-border bg-card"
          />
        </div>
      )}

      {/* Pulse ring */}
      <div
        className="absolute inset-0 rounded-full map-pin-pulse"
        style={{
          width: 28,
          height: 28,
          top: -8,
          left: -8,
          backgroundColor: color,
          opacity: 0.3,
        }}
      />

      {/* Middle glow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 20,
          height: 20,
          top: -4,
          left: -4,
          backgroundColor: color,
          opacity: 0.2,
        }}
      />

      {/* Inner dot / ring */}
      {isApproximate ? (
        // Ring outline for approximate locations
        <div
          className={`rounded-full transition-transform duration-200 ${isSelected ? "map-pin-selected" : ""}`}
          style={{
            width: 12,
            height: 12,
            border: `2px solid ${color}`,
            backgroundColor: "transparent",
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ) : (
        // Filled dot for precise locations
        <div
          className={`rounded-full transition-transform duration-200 ${isSelected ? "map-pin-selected" : ""}`}
          style={{
            width: 12,
            height: 12,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}, 0 0 16px ${color}40`,
          }}
        />
      )}
    </div>
  );
}
