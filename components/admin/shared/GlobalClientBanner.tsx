"use client";

import { useRouter } from "next/navigation";
import { X, ArrowLeftRight } from "lucide-react";
import { useActivePrincipal } from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  coral: "bg-orange-500",
  pink: "bg-pink-500",
  green: "bg-emerald-500",
};

const ACCENT_BORDER: Record<string, string> = {
  amber: "border-amber-500/50",
  blue: "border-blue-500/50",
  teal: "border-teal-500/50",
  purple: "border-purple-500/50",
  coral: "border-orange-500/50",
  pink: "border-pink-500/50",
  green: "border-emerald-500/50",
};

export function GlobalClientBanner() {
  const { activePrincipal, clearActivePrincipal } = useActivePrincipal();
  const { isAdmin } = useRole();
  const router = useRouter();

  if (!activePrincipal || !isAdmin) return null;

  const dotClass = ACCENT_DOT[activePrincipal.accentColor] || ACCENT_DOT.amber;
  const borderClass = ACCENT_BORDER[activePrincipal.accentColor] || ACCENT_BORDER.amber;

  return (
    <div
      className={`flex items-center justify-between border-b ${borderClass} bg-card/80 px-4 py-2 sm:px-6`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <span className="text-sm text-muted-foreground">
          Viewing as:{" "}
          <span className="font-semibold text-foreground">
            {activePrincipal.displayName}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftRight className="h-3 w-3" />
          Switch
        </button>
        <button
          onClick={() => {
            clearActivePrincipal();
            router.push("/admin");
          }}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Exit
        </button>
      </div>
    </div>
  );
}
