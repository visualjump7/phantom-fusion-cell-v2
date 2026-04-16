/**
 * System event aggregator — merges bills (cash flow), messages (decision
 * due dates), and travel legs (when the travel tables exist) into a single
 * normalized event shape for the calendar view.
 *
 * System events are always visible (can't be toggled off via source filter);
 * they represent the app's own scheduled things, not external calendar feeds.
 */

import { supabase } from "@/lib/supabase";
import { fetchBillsForRange } from "@/lib/bill-service";
import { fetchMessages } from "@/lib/message-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type SystemEventKind = "cashflow" | "decision" | "travel";

export interface SystemEvent {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  source: "system";
  sourceKind: SystemEventKind;
  href: string;
  assetId?: string | null;
  color: string;
}

const COLOR = {
  cashflow: "#10b981",
  decision: "#ef4444",
  travel: "#4ADE80",
};

export async function fetchSystemEvents(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<SystemEvent[]> {
  const [bills, messages, travelLegs] = await Promise.all([
    fetchBillsCashflow(orgId, startDate, endDate),
    fetchDecisionMessages(orgId, startDate, endDate),
    fetchTravelLegs(orgId, startDate, endDate),
  ]);
  return [...bills, ...messages, ...travelLegs];
}

async function fetchBillsCashflow(
  orgId: string,
  start: Date,
  end: Date
): Promise<SystemEvent[]> {
  try {
    const bills = await fetchBillsForRange(
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
      undefined,
      orgId
    );
    return bills.map((b) => ({
      id: `bill-${b.id}`,
      title: `${b.title || b.payee || "Bill"} — $${(b.amount_cents / 100).toLocaleString()}`,
      start: new Date(b.due_date),
      end: null,
      source: "system" as const,
      sourceKind: "cashflow" as const,
      href: `/cash-flow`,
      assetId: b.asset_id ?? null,
      color: COLOR.cashflow,
    }));
  } catch (err) {
    console.warn("[calendar-system] bills fetch failed", err);
    return [];
  }
}

async function fetchDecisionMessages(
  orgId: string,
  start: Date,
  end: Date
): Promise<SystemEvent[]> {
  try {
    const msgs = await fetchMessages({ organization_id: orgId });
    return msgs
      .filter((m) => m.type === "decision" || m.type === "action_required")
      .filter((m) => m.due_date)
      .map((m) => ({ m, due: new Date(m.due_date as string) }))
      .filter(({ due }) => due >= start && due <= end)
      .map(({ m, due }) => ({
        id: `msg-${m.id}`,
        title: m.title || "Decision",
        start: due,
        end: null,
        source: "system" as const,
        sourceKind: "decision" as const,
        href: `/messages`,
        assetId: m.asset_id ?? null,
        color: COLOR.decision,
      }));
  } catch (err) {
    console.warn("[calendar-system] messages fetch failed", err);
    return [];
  }
}

async function fetchTravelLegs(
  orgId: string,
  start: Date,
  end: Date
): Promise<SystemEvent[]> {
  try {
    const { data, error } = await db
      .from("travel_legs")
      .select(
        "id, itinerary_id, leg_type, provider, departure_location, arrival_location, departure_time, arrival_time, travel_itineraries(status, title)"
      )
      .eq("organization_id", orgId)
      .gte("departure_time", start.toISOString())
      .lte("departure_time", end.toISOString());

    if (error) {
      // Most commonly "table does not exist" until Phase 8 ships — silently skip.
      return [];
    }

    return (data || [])
      .filter(
        (row: { travel_itineraries?: { status?: string } }) =>
          row.travel_itineraries?.status === "published"
      )
      .map((row: any) => ({
        id: `travel-${row.id}`,
        title: `${row.provider || row.leg_type}: ${row.departure_location || ""} → ${row.arrival_location || ""}`.trim(),
        start: new Date(row.departure_time),
        end: row.arrival_time ? new Date(row.arrival_time) : null,
        source: "system" as const,
        sourceKind: "travel" as const,
        href: `/travel/${row.itinerary_id}`,
        color: COLOR.travel,
      }));
  } catch {
    return [];
  }
}
