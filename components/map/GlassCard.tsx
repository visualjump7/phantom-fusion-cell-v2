"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10",
        "bg-black/40 backdrop-blur-xl",
        "shadow-2xl shadow-black/20",
        "pointer-events-auto",
        className
      )}
    >
      {children}
    </div>
  );
}
