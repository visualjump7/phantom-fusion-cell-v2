"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useClientContext } from "@/lib/use-client-context";
import { Badge } from "@/components/ui/badge";

const ACCENT_COLORS: Record<string, string> = {
  amber: "border-l-amber-500",
  blue: "border-l-blue-500",
  teal: "border-l-teal-500",
  purple: "border-l-purple-500",
  coral: "border-l-orange-500",
  pink: "border-l-pink-500",
  green: "border-l-emerald-500",
};

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  coral: "bg-orange-500",
  pink: "bg-pink-500",
  green: "bg-emerald-500",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  onboarding: { label: "Onboarding", variant: "secondary" },
  paused: { label: "Paused", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
};

export function ClientBanner() {
  const { clientName, accentColor, status, isLoading } = useClientContext();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-card/50 px-6 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading workspace...</span>
      </div>
    );
  }

  const borderClass = ACCENT_COLORS[accentColor] || ACCENT_COLORS.amber;
  const dotClass = ACCENT_DOT[accentColor] || ACCENT_DOT.amber;
  const statusConfig = STATUS_LABELS[status] || STATUS_LABELS.active;

  return (
    <div className={`flex items-center justify-between border-b border-border border-l-4 ${borderClass} bg-card/50 px-6 py-3`}>
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Command Center
        </Link>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
          <span className="text-sm font-semibold text-foreground">{clientName}&apos;s Workspace</span>
        </div>
      </div>
      <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
    </div>
  );
}
