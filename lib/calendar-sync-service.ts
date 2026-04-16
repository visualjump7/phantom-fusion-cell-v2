/**
 * Calendar sync service. **Server-only** — node-ical pulls Node built-ins
 * (node:crypto, node:fs) that break client bundling. Browser code should
 * call the /api/calendar/sync-source route instead.
 *
 * syncSource       — fetch + parse a single source, upsert cache rows,
 *                    trim stale rows inside the window, update status.
 * syncAllActiveSources — iterate active sources respecting a 30-min cooldown.
 * syncSourcesForOrg — manual admin trigger, ignores cooldown.
 */

import { fetchAndParseICS, type ParsedEvent } from "@/lib/calendar-ics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

const COOLDOWN_MS = 30 * 60 * 1000;
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 90;

export interface CalendarSourceRow {
  id: string;
  organization_id: string;
  principal_id: string | null;
  label: string;
  provider_hint: string | null;
  ics_url: string;
  color: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export interface SyncResult {
  sourceId: string;
  success: boolean;
  eventsUpserted: number;
  eventsPruned: number;
  error?: string;
}

export function createCalendarSync(client: Client) {
  async function syncSource(sourceId: string): Promise<SyncResult> {
    const { data: source, error } = await client
      .from("calendar_sources")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle();

    if (error || !source) {
      return {
        sourceId,
        success: false,
        eventsUpserted: 0,
        eventsPruned: 0,
        error: error?.message ?? "Source not found",
      };
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
    const windowEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

    let events: ParsedEvent[] = [];
    try {
      events = await fetchAndParseICS(source.ics_url, {
        lookbackDays: LOOKBACK_DAYS,
        lookaheadDays: LOOKAHEAD_DAYS,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await client
        .from("calendar_sources")
        .update({
          last_synced_at: now.toISOString(),
          last_sync_status: `error: ${msg.slice(0, 120)}`,
          last_sync_error: msg,
        })
        .eq("id", sourceId);
      return { sourceId, success: false, eventsUpserted: 0, eventsPruned: 0, error: msg };
    }

    const rows = events.map((e) => ({
      source_id: sourceId,
      organization_id: source.organization_id,
      external_uid: e.uid,
      title: e.title,
      description: e.description,
      location: e.location,
      start_time: e.start.toISOString(),
      end_time: e.end ? e.end.toISOString() : null,
      is_all_day: e.isAllDay,
      raw_data: e.raw,
      fetched_at: now.toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upsertErr } = await client
        .from("calendar_events_cache")
        .upsert(rows, { onConflict: "source_id,external_uid" });
      if (upsertErr) {
        await client
          .from("calendar_sources")
          .update({
            last_synced_at: now.toISOString(),
            last_sync_status: `error: ${upsertErr.message.slice(0, 120)}`,
            last_sync_error: upsertErr.message,
          })
          .eq("id", sourceId);
        return {
          sourceId,
          success: false,
          eventsUpserted: 0,
          eventsPruned: 0,
          error: upsertErr.message,
        };
      }
    }

    // Prune stale rows inside the window that weren't seen this fetch.
    const seenUids = new Set(rows.map((r) => r.external_uid));
    const { data: existing } = await client
      .from("calendar_events_cache")
      .select("id, external_uid, start_time")
      .eq("source_id", sourceId)
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString());

    const stale = (existing || [])
      .filter((r: { external_uid: string }) => !seenUids.has(r.external_uid))
      .map((r: { id: string }) => r.id);

    let prunedCount = 0;
    if (stale.length > 0) {
      const { error: delErr } = await client
        .from("calendar_events_cache")
        .delete()
        .in("id", stale);
      if (!delErr) prunedCount = stale.length;
    }

    await client
      .from("calendar_sources")
      .update({
        last_synced_at: now.toISOString(),
        last_sync_status: "ok",
        last_sync_error: null,
      })
      .eq("id", sourceId);

    return {
      sourceId,
      success: true,
      eventsUpserted: rows.length,
      eventsPruned: prunedCount,
    };
  }

  async function syncAllActiveSources(): Promise<SyncResult[]> {
    const threshold = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { data } = await client
      .from("calendar_sources")
      .select("id, last_synced_at")
      .eq("is_active", true);

    const due = (data || []).filter(
      (r: { last_synced_at: string | null }) =>
        !r.last_synced_at || r.last_synced_at < threshold
    );

    const results: SyncResult[] = [];
    for (const row of due) {
      // Sequential to avoid thundering herd on shared free-tier network.
      // eslint-disable-next-line no-await-in-loop
      results.push(await syncSource(row.id));
    }
    return results;
  }

  async function syncSourcesForOrg(orgId: string): Promise<SyncResult[]> {
    const { data } = await client
      .from("calendar_sources")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_active", true);
    const results: SyncResult[] = [];
    for (const row of data || []) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await syncSource(row.id));
    }
    return results;
  }

  return { syncSource, syncAllActiveSources, syncSourcesForOrg };
}

// Callers must pass their own supabase client (anon for route handlers,
// service-role for the Edge Function).
