"use client";

/**
 * PrincipalSummary — quick-glance cards that appear BELOW the orbital
 * ring on /command. Principal-facing only (executives + delegates).
 *
 * Which cards are shown is driven by `principal_summary_config` via
 * `getVisibleSummaryCardsForPrincipal()`. Admin toggles them on per
 * principal in /admin/client/[orgId]/principal-experience.
 *
 * Each card fetches its own data (independent loading states — one slow
 * query doesn't hold up the others) and has a "tap to open" affordance
 * that calls the corresponding orbital module via useCommand().
 *
 * Cards intentionally duplicate what's behind the orbital icons — the
 * user's ask was explicit that they want the principal to have the
 * choice to either tap the orb or scroll down for the same info.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Plane,
  FileText,
  Scale,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeAgo } from "@/lib/utils";
import {
  SUMMARY_CARDS,
  type SummaryCardKey,
} from "@/lib/principal-summary-service";
import { fetchMessages } from "@/lib/message-service";
import { fetchItineraries } from "@/lib/travel-service";
import { fetchLatestPublishedBrief, type Brief } from "@/lib/brief-service";
import { useCommand } from "@/components/command/CommandContext";
import type { ModuleKey } from "@/lib/modules";

interface PrincipalSummaryProps {
  orgId: string;
  visibleCards: SummaryCardKey[];
}

export function PrincipalSummary({
  orgId,
  visibleCards,
}: PrincipalSummaryProps) {
  if (visibleCards.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-16 pt-4 sm:px-6">
      {visibleCards.map((key) => (
        <SummaryCardFor key={key} cardKey={key} orgId={orgId} />
      ))}
    </section>
  );
}

function SummaryCardFor({
  cardKey,
  orgId,
}: {
  cardKey: SummaryCardKey;
  orgId: string;
}) {
  switch (cardKey) {
    case "top_alerts":
      return <TopAlertsCard orgId={orgId} />;
    case "upcoming_travel":
      return <UpcomingTravelCard orgId={orgId} />;
    case "latest_brief":
      return <LatestBriefCard orgId={orgId} />;
    case "pending_decisions":
      return <PendingDecisionsCard orgId={orgId} />;
  }
}

/**
 * Shared card shell. Title + icon + tap-through to open the matching
 * orbital module overlay. Children render the card's data body.
 */
function CardShell({
  title,
  icon: Icon,
  cardKey,
  children,
}: {
  title: string;
  icon: typeof AlertTriangle;
  cardKey: SummaryCardKey;
  children: React.ReactNode;
}) {
  const { openModule } = useCommand();
  const meta = SUMMARY_CARDS.find((c) => c.key === cardKey);
  const target = (meta?.opensModule ?? "") as ModuleKey;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => target && openModule(target)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && target) {
          e.preventDefault();
          openModule(target);
        }
      }}
      className="cursor-pointer border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-emerald-400/40 hover:bg-card/80"
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <ChevronRight
            className="h-4 w-4 text-muted-foreground"
            aria-hidden
          />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground">{label}</p>;
}
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-3">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

// ============================================
// Top Alerts
// ============================================

function TopAlertsCard({ orgId }: { orgId: string }) {
  const [alerts, setAlerts] = useState<
    | Array<{
        id: string;
        title: string;
        priority: string;
        created_at: string;
      }>
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    fetchMessages({ organization_id: orgId }).then((msgs) => {
      if (cancelled) return;
      // "Unresolved" = no response. Messages service returns `response`
      // nullable; we also filter to alert/action_required types.
      const unresolved = (msgs ?? [])
        .filter(
          (m: {
            type?: string;
            response?: unknown;
            is_archived?: boolean;
            is_deleted?: boolean;
          }) =>
            !m.is_archived &&
            !m.is_deleted &&
            !m.response &&
            (m.type === "alert" ||
              m.type === "action_required" ||
              m.type === "decision")
        )
        .slice(0, 4);
      setAlerts(
        unresolved as Array<{
          id: string;
          title: string;
          priority: string;
          created_at: string;
        }>
      );
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const priorityColor: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-amber-500",
    medium: "bg-blue-500",
    low: "bg-zinc-500",
  };

  return (
    <CardShell title="Top Alerts" icon={AlertTriangle} cardKey="top_alerts">
      {alerts === null ? (
        <LoadingState />
      ) : alerts.length === 0 ? (
        <EmptyState label="No unresolved alerts — you're clear." />
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  priorityColor[a.priority] ?? "bg-zinc-500"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(a.created_at)} · {a.priority}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

// ============================================
// Upcoming Travel
// ============================================

function UpcomingTravelCard({ orgId }: { orgId: string }) {
  const [trips, setTrips] = useState<
    | Array<{
        id: string;
        title: string;
        trip_start: string | null;
        trip_end: string | null;
      }>
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    const todayIso = new Date().toISOString().slice(0, 10);
    fetchItineraries(orgId, {
      status: "published",
      startDate: todayIso,
    }).then((rows) => {
      if (cancelled) return;
      setTrips(
        rows.slice(0, 3).map((t) => ({
          id: t.id,
          title: t.title,
          trip_start: t.trip_start,
          trip_end: t.trip_end,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const fmt = (iso: string | null): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <CardShell
      title="Upcoming Travel"
      icon={Plane}
      cardKey="upcoming_travel"
    >
      {trips === null ? (
        <LoadingState />
      ) : trips.length === 0 ? (
        <EmptyState label="No upcoming published trips." />
      ) : (
        <ul className="space-y-2">
          {trips.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm text-foreground">
                {t.title}
              </p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {fmt(t.trip_start)}
                {t.trip_end && t.trip_end !== t.trip_start
                  ? ` – ${fmt(t.trip_end)}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

// ============================================
// Latest Daily Brief
// ============================================

function LatestBriefCard({ orgId }: { orgId: string }) {
  const [brief, setBrief] = useState<Brief | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchLatestPublishedBrief(orgId).then((b) => {
      if (!cancelled) setBrief(b);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const fmt = (iso: string | null): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <CardShell title="Latest Daily Brief" icon={FileText} cardKey="latest_brief">
      {brief === undefined ? (
        <LoadingState />
      ) : brief === null ? (
        <EmptyState label="No published briefs yet." />
      ) : (
        <div>
          <p className="text-sm font-medium text-foreground">
            {brief.title || "Daily Brief"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmt(brief.brief_date)}
          </p>
        </div>
      )}
    </CardShell>
  );
}

// ============================================
// Pending Decisions
// ============================================

function PendingDecisionsCard({ orgId }: { orgId: string }) {
  const [decisions, setDecisions] = useState<
    | Array<{
        id: string;
        title: string;
        priority: string;
        due_date: string | null;
      }>
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    fetchMessages({ organization_id: orgId }).then((msgs) => {
      if (cancelled) return;
      const pending = (msgs ?? [])
        .filter(
          (m: {
            type?: string;
            response?: unknown;
            is_archived?: boolean;
            is_deleted?: boolean;
          }) =>
            m.type === "decision" &&
            !m.is_archived &&
            !m.is_deleted &&
            !m.response
        )
        .slice(0, 4);
      setDecisions(
        pending as Array<{
          id: string;
          title: string;
          priority: string;
          due_date: string | null;
        }>
      );
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const priorityVariant = (p: string) => {
    if (p === "urgent") return "bg-red-500/20 text-red-300";
    if (p === "high") return "bg-amber-500/20 text-amber-300";
    if (p === "medium") return "bg-blue-500/20 text-blue-300";
    return "bg-zinc-500/20 text-zinc-300";
  };

  return (
    <CardShell
      title="Pending Decisions"
      icon={Scale}
      cardKey="pending_decisions"
    >
      {decisions === null ? (
        <LoadingState />
      ) : decisions.length === 0 ? (
        <EmptyState label="Nothing awaiting your decision." />
      ) : (
        <ul className="space-y-2">
          {decisions.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-2"
            >
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                {d.title}
              </p>
              <Badge
                variant="outline"
                className={`shrink-0 border-transparent text-[10px] uppercase ${priorityVariant(
                  d.priority
                )}`}
              >
                {d.priority}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}
