"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Building2, Receipt, MessageSquare, ChevronRight, MoreVertical, Trash2, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ClientSummary } from "@/lib/client-service";

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
  amber: "hover:border-amber-500/40",
  blue: "hover:border-blue-500/40",
  teal: "hover:border-teal-500/40",
  purple: "hover:border-purple-500/40",
  coral: "hover:border-orange-500/40",
  pink: "hover:border-pink-500/40",
  green: "hover:border-emerald-500/40",
};

interface ClientCardProps {
  summary: ClientSummary;
  onSelect?: (summary: ClientSummary) => void;
  onDelete?: (summary: ClientSummary) => void;
}

export function ClientCard({ summary, onSelect, onDelete }: ClientCardProps) {
  const dotClass = ACCENT_DOT[summary.accentColor] || ACCENT_DOT.amber;
  const borderClass = ACCENT_BORDER[summary.accentColor] || ACCENT_BORDER.amber;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.preventDefault();
      onSelect(summary);
    }
  };

  return (
    <div className="relative">
      <Link href={`/admin/client/${summary.orgId}`} onClick={handleClick}>
        <Card className={`group cursor-pointer border-border transition-all ${borderClass} hover:bg-muted/30`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${dotClass}`} />
                <h3 className="text-base font-semibold text-foreground">{summary.displayName}</h3>
                {summary.status !== "active" && (
                  <Badge variant="outline" className="text-xs">{summary.status}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{summary.projectsCount}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{summary.pendingBillsCount}</p>
                  <p className="text-xs text-muted-foreground">Pending bills</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{summary.unresolvedAlertsCount}</p>
                  <p className="text-xs text-muted-foreground">Alerts</p>
                </div>
              </div>
            </div>

            {summary.projectsValue > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Total project value: {formatCurrency(summary.projectsValue)}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Three-dot menu */}
      <div className="absolute right-3 top-3" ref={menuRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 [div:hover>&]:opacity-100"
          style={{ opacity: menuOpen ? 1 : undefined }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-10 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onSelect?.(summary);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <LogIn className="h-3.5 w-3.5" /> Enter workspace
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(summary);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete principal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
