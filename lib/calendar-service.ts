/**
 * Unified calendar fetch — returns external (ICS) + system events for a
 * given window, scoped to the current principal's accessible sources.
 */

import { supabase } from "@/lib/supabase";
import { fetchSystemEvents, type SystemEvent } from "@/lib/calendar-system";
import { normalizeIcsUrl } from "@/lib/calendar-url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ExternalEvent {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceColor: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  isAllDay: boolean;
}

export interface UnifiedEvents {
  external: ExternalEvent[];
  system: SystemEvent[];
}

export async function fetchAllEvents(
  orgId: string,
  principalId: string | null,
  startDate: Date,
  endDate: Date
): Promise<UnifiedEvents> {
  const [external, system] = await Promise.all([
    fetchExternalEvents(orgId, principalId, startDate, endDate),
    fetchSystemEvents(orgId, startDate, endDate),
  ]);
  return { external, system };
}

async function fetchExternalEvents(
  orgId: string,
  principalId: string | null,
  start: Date,
  end: Date
): Promise<ExternalEvent[]> {
  // Resolve active sources for this org (RLS already restricts principals
  // to their own rows; admins see all in the org).
  let sourceQuery = db
    .from("calendar_sources")
    .select("id, label, color, is_active, principal_id")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (principalId) {
    sourceQuery = sourceQuery.eq("principal_id", principalId);
  }

  const { data: sources, error: sourceErr } = await sourceQuery;
  if (sourceErr || !sources || sources.length === 0) return [];

  const sourceById = new Map<string, { label: string; color: string }>();
  for (const s of sources as Array<{ id: string; label: string; color: string | null }>) {
    sourceById.set(s.id, { label: s.label, color: s.color || "#60A5FA" });
  }
  const sourceIds = Array.from(sourceById.keys());

  const { data: events, error: eventsErr } = await db
    .from("calendar_events_cache")
    .select("id, source_id, title, description, location, start_time, end_time, is_all_day")
    .in("source_id", sourceIds)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString());

  if (eventsErr || !events) return [];

  return (events as Array<{
    id: string;
    source_id: string;
    title: string | null;
    description: string | null;
    location: string | null;
    start_time: string;
    end_time: string | null;
    is_all_day: boolean;
  }>).map((r) => {
    const meta = sourceById.get(r.source_id) ?? { label: "Calendar", color: "#60A5FA" };
    return {
      id: r.id,
      sourceId: r.source_id,
      sourceLabel: meta.label,
      sourceColor: meta.color,
      title: r.title ?? "(untitled)",
      description: r.description,
      location: r.location,
      start: new Date(r.start_time),
      end: r.end_time ? new Date(r.end_time) : null,
      isAllDay: r.is_all_day,
    };
  });
}

export async function fetchCalendarSources(
  orgId: string,
  principalId?: string | null
) {
  let q = db
    .from("calendar_sources")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (principalId) q = q.eq("principal_id", principalId);
  const { data, error } = await q;
  if (error) {
    console.error("[fetchCalendarSources]", error);
    return [];
  }
  return data || [];
}

export async function createCalendarSource(input: {
  organization_id: string;
  principal_id: string | null;
  label: string;
  provider_hint: string;
  ics_url: string;
  color?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await db
    .from("calendar_sources")
    .insert({
      organization_id: input.organization_id,
      principal_id: input.principal_id,
      label: input.label,
      provider_hint: input.provider_hint,
      ics_url: normalizeIcsUrl(input.ics_url),
      color: input.color || "#60A5FA",
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

export async function updateCalendarSource(
  id: string,
  patch: Partial<{ label: string; color: string; ics_url: string; is_active: boolean; provider_hint: string }>
): Promise<{ success: boolean; error?: string }> {
  const normalized = patch.ics_url
    ? { ...patch, ics_url: normalizeIcsUrl(patch.ics_url) }
    : patch;
  const { error } = await db.from("calendar_sources").update(normalized).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteCalendarSource(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("calendar_sources").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
