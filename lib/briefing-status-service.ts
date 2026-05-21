/**
 * Briefing-layout status data.
 *
 * One call returns everything the briefing layout needs:
 *   - top chips (overdue cash flow, pending decisions, action items, next travel)
 *   - dynamic green subhead under the greeting
 *   - per-section right-column meta strings + badges
 *
 * Queries run in parallel and reuse the existing bill / message / travel /
 * brief services so we don't introduce a second source of truth. Anything we
 * can't confidently compute right now falls back to a sensible static label
 * (e.g. Calendar = "Today", Contacts = "Directory") — easy to wire to live
 * counts in a follow-up without changing this shape.
 */

import { fetchBillSummary } from "@/lib/bill-service";
import { fetchMessages } from "@/lib/message-service";
import { fetchItineraries, type TravelStatus } from "@/lib/travel-service";
import { fetchLatestPublishedBrief } from "@/lib/brief-service";
import { supabase } from "@/lib/supabase";
import { ALL_MODULE_KEYS, MODULE_KEYS, type ModuleKey } from "@/lib/modules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface BriefingChips {
  overdueCashFlow: number;
  pendingDecisions: number;
  actionItems: number;
  /** Next published itinerary, with days until trip_start (clamped to >= 0). */
  nextTravel: { title: string; daysAway: number } | null;
}

export interface SectionStatus {
  /** Right-column one-liner. Empty string renders nothing. */
  summary: string;
  /** Optional numeric badge. 0 / undefined renders nothing. */
  badge?: number;
  /** "red" reserves attention for overdue / overdue-style states. */
  badgeColor?: "red" | "amber" | "default";
}

export interface BriefingSnapshot {
  chips: BriefingChips;
  /** Dynamic green sub-line under the greeting. Always non-empty. */
  subhead: string;
  /** Right-column meta per visible module key. */
  sections: Partial<Record<ModuleKey, SectionStatus>>;
}

const EMPTY_SNAPSHOT: BriefingSnapshot = {
  chips: {
    overdueCashFlow: 0,
    pendingDecisions: 0,
    actionItems: 0,
    nextTravel: null,
  },
  subhead: "Your day at a glance.",
  sections: {},
};

// ============================================
// Helpers
// ============================================

function daysFromNow(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  const now = Date.now();
  const diffMs = t - now;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Title-style suffix for a trip's start date — picks "Today", "Tomorrow", a
 * weekday for next 6 days, else "Mon 3" style. Mirrors the chip the
 * reference design used ("Art Basel Week · Fri").
 */
function shortDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pluralizeItems(n: number): string {
  return n === 1 ? "item" : "items";
}

function pluralizeDecisions(n: number): string {
  return n === 1 ? "decision" : "decisions";
}

// ============================================
// Main loader
// ============================================

export async function loadBriefingSnapshot(
  orgId: string,
  principalId: string | null
): Promise<BriefingSnapshot> {
  if (!orgId) return EMPTY_SNAPSHOT;

  // Run everything in parallel — none of these queries depend on each other.
  const [billsRes, messagesRes, itinerariesRes, latestBriefRes, assetsRes] =
    await Promise.allSettled([
      fetchBillSummary(orgId),
      fetchMessages({ organization_id: orgId }),
      // Only published trips count for the "next travel" chip; drafts would
      // confuse the executive who hasn't seen them yet.
      fetchItineraries(orgId, {
        status: "published" as TravelStatus,
        startDate: new Date().toISOString(),
      }),
      fetchLatestPublishedBrief(orgId),
      db
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_deleted", false),
    ]);

  // ---- chips ----
  const billsSummary =
    billsRes.status === "fulfilled" ? billsRes.value : null;
  const overdueCashFlow = billsSummary?.overdueCount ?? 0;

  const messages =
    messagesRes.status === "fulfilled" ? messagesRes.value : [];
  const pendingDecisions = messages.filter(
    (m) => m.type === "decision" && !m.response
  ).length;
  const actionItems = messages.filter(
    (m) => m.type === "action_required" && !m.response
  ).length;

  const itineraries =
    itinerariesRes.status === "fulfilled" ? itinerariesRes.value : [];
  // Sort defensively even though the service already orders by trip_start.
  const nextItinerary = [...itineraries]
    .filter((i) => !!i.trip_start)
    .sort((a, b) => (a.trip_start! < b.trip_start! ? -1 : 1))[0];
  const nextTravel: BriefingChips["nextTravel"] = nextItinerary
    ? {
        title: nextItinerary.title || "Next trip",
        daysAway: daysFromNow(nextItinerary.trip_start!),
      }
    : null;

  const chips: BriefingChips = {
    overdueCashFlow,
    pendingDecisions,
    actionItems,
    nextTravel,
  };

  // ---- subhead (priority order) ----
  let subhead = "Your day at a glance.";
  if (overdueCashFlow > 0) {
    subhead = `${overdueCashFlow} past due in cash flow.`;
  } else if (pendingDecisions > 0) {
    subhead = `${pendingDecisions} ${pluralizeDecisions(pendingDecisions)} awaiting you.`;
  } else if (actionItems > 0) {
    subhead = `${actionItems} action ${pluralizeItems(actionItems)} open.`;
  } else if (nextTravel && nextTravel.daysAway <= 7) {
    if (nextTravel.daysAway === 0) {
      subhead = `${nextTravel.title} starts today.`;
    } else if (nextTravel.daysAway === 1) {
      subhead = `${nextTravel.title} tomorrow.`;
    } else {
      subhead = `${nextTravel.title} in ${nextTravel.daysAway}d.`;
    }
  }

  // ---- per-section meta ----
  const latestBrief =
    latestBriefRes.status === "fulfilled" ? latestBriefRes.value : null;

  const projectCount =
    assetsRes.status === "fulfilled"
      ? // supabase head+count query returns count separately
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((assetsRes.value as any)?.count as number | null) ?? 0
      : 0;

  const sections: Partial<Record<ModuleKey, SectionStatus>> = {
    [MODULE_KEYS.DASHBOARD]: { summary: "Overview" },
    [MODULE_KEYS.DAILY_BRIEF]: latestBrief
      ? {
          summary:
            latestBrief.published_at &&
            shortDateLabel(latestBrief.published_at) === "Today"
              ? "Today"
              : `Updated ${
                  latestBrief.published_at
                    ? shortDateLabel(latestBrief.published_at)
                    : ""
                }`.trim(),
        }
      : { summary: "No brief yet" },
    [MODULE_KEYS.COMMS]:
      pendingDecisions + actionItems > 0
        ? {
            summary: "Awaiting reply",
            badge: pendingDecisions + actionItems,
            badgeColor: "red",
          }
        : { summary: "All clear" },
    [MODULE_KEYS.TRAVEL]: nextTravel
      ? {
          summary: nextItinerary?.trip_start
            ? `${nextTravel.title} · ${shortDateLabel(nextItinerary.trip_start)}`
            : nextTravel.title,
        }
      : { summary: "No upcoming trips" },
    [MODULE_KEYS.BUDGETS]: { summary: "Active" },
    [MODULE_KEYS.CASH_FLOW]:
      overdueCashFlow > 0
        ? {
            summary: `${overdueCashFlow} past due`,
            badge: overdueCashFlow,
            badgeColor: "red",
          }
        : { summary: "On track" },
    [MODULE_KEYS.PROJECTS]:
      projectCount > 0
        ? { summary: `${projectCount} active` }
        : { summary: "None active" },
    [MODULE_KEYS.CONTACTS]: { summary: "Directory" },
    [MODULE_KEYS.CALENDAR]: { summary: "Today" },
  };

  // Quietly drop keys that aren't in the registered module set so a future
  // module rename doesn't leak stale data into the UI.
  for (const k of Object.keys(sections) as ModuleKey[]) {
    if (!ALL_MODULE_KEYS.includes(k)) delete sections[k];
  }

  // Use the principalId param somewhere — currently per-executive scoping is
  // already encoded in the org-scoped queries above (an executive only sees
  // bills / messages / travel for their org). Reserved for when a query
  // needs to filter to "messages addressed to this executive" etc.
  void principalId;

  return { chips, subhead, sections };
}
