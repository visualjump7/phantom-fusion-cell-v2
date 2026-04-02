"use client";

import { ArrowLeft, Layers } from "lucide-react";

interface MobileTopBarProps {
  onBack: () => void;
  principalName?: string;
  mapStyle: "dark" | "satellite";
  onMapStyleChange: (style: "dark" | "satellite") => void;
}

export function MobileTopBar({
  onBack,
  principalName,
  mapStyle,
  onMapStyleChange,
}: MobileTopBarProps) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 pointer-events-auto"
      style={{
        paddingTop: "max(16px, env(safe-area-inset-top))",
        background:
          "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)",
      }}
    >
      <div className="flex items-center justify-between px-4 pb-3">
        {/* Left — Back */}
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/10 active:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-white/80" />
        </button>

        {/* Center — Principal name */}
        {principalName && (
          <span className="text-xs text-white/60 font-medium truncate max-w-[50%]">
            {principalName}
          </span>
        )}

        {/* Right — Map style toggle */}
        <button
          onClick={() =>
            onMapStyleChange(mapStyle === "dark" ? "satellite" : "dark")
          }
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/10 active:bg-white/10 transition-colors"
        >
          <Layers className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </div>
  );
}
