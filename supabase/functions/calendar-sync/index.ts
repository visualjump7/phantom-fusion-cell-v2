/**
 * Supabase Edge Function — calendar-sync.
 *
 * Scheduled via pg_cron (every 30 min) to poll active ICS calendar sources
 * and refresh the calendar_events_cache. Runs under the service-role key so
 * it can bypass RLS for housekeeping. Deployment is handled outside this
 * repo — see supabase/functions/calendar-sync/README.md for details.
 *
 * Runtime: Deno, not Node. The imports below resolve in Deno Deploy.
 */

// @ts-ignore — Deno import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — Deno import
import ICAL from "https://esm.sh/node-ical@0.18.0";

const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 90;
const COOLDOWN_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

interface ParsedEvent {
  uid: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  isAllDay: boolean;
  raw: Record<string, unknown>;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseICS(text: string): ParsedEvent[] {
  const parsed = (ICAL as any).parseICS(text) as Record<string, any>;
  const now = Date.now();
  const windowStart = new Date(now - LOOKBACK_DAYS * 86_400_000);
  const windowEnd = new Date(now + LOOKAHEAD_DAYS * 86_400_000);

  const results: ParsedEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== "VEVENT") continue;
    const baseUid: string = ev.uid || ev.UID || `${ev.summary ?? "event"}-${key}`;

    if (ev.rrule) {
      const occurrences: Date[] = ev.rrule.between(windowStart, windowEnd, true);
      for (const occurrence of occurrences) {
        const duration =
          ev.end && ev.start
            ? new Date(ev.end).getTime() - new Date(ev.start).getTime()
            : 0;
        const end = duration > 0 ? new Date(occurrence.getTime() + duration) : null;
        results.push(toEvent(ev, `${baseUid}@${occurrence.toISOString()}`, occurrence, end));
      }
      continue;
    }

    const start = ev.start ? new Date(ev.start) : null;
    const end = ev.end ? new Date(ev.end) : null;
    if (!start) continue;
    if (start > windowEnd) continue;
    if ((end ?? start) < windowStart) continue;
    results.push(toEvent(ev, baseUid, start, end));
  }

  return results;
}

function toEvent(ev: any, uid: string, start: Date, end: Date | null): ParsedEvent {
  return {
    uid,
    title: ev.summary ?? null,
    description: ev.description ?? null,
    location: ev.location ?? null,
    start,
    end,
    isAllDay: Boolean(ev.datetype === "date"),
    raw: {
      status: ev.status ?? null,
      organizer: ev.organizer ?? null,
      categories: ev.categories ?? null,
      url: ev.url ?? null,
    },
  };
}

async function syncOne(client: any, source: any) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

  try {
    const text = await fetchText(source.ics_url);
    const events = parseICS(text);

    if (events.length > 0) {
      const rows = events.map((e) => ({
        source_id: source.id,
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
      await client
        .from("calendar_events_cache")
        .upsert(rows, { onConflict: "source_id,external_uid" });
    }

    const seen = new Set(events.map((e) => e.uid));
    const { data: existing } = await client
      .from("calendar_events_cache")
      .select("id, external_uid, start_time")
      .eq("source_id", source.id)
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString());

    const stale = (existing || [])
      .filter((r: any) => !seen.has(r.external_uid))
      .map((r: any) => r.id);
    if (stale.length > 0) {
      await client.from("calendar_events_cache").delete().in("id", stale);
    }

    await client
      .from("calendar_sources")
      .update({
        last_synced_at: now.toISOString(),
        last_sync_status: "ok",
        last_sync_error: null,
      })
      .eq("id", source.id);

    return { id: source.id, upserted: events.length, pruned: stale.length, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await client
      .from("calendar_sources")
      .update({
        last_synced_at: now.toISOString(),
        last_sync_status: `error: ${msg.slice(0, 120)}`,
        last_sync_error: msg,
      })
      .eq("id", source.id);
    return { id: source.id, success: false, error: msg };
  }
}

// @ts-ignore — Deno.serve
Deno.serve(async (_req: Request) => {
  // @ts-ignore — Deno.env
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore — Deno.env
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(url, key, { auth: { persistSession: false } });

  const threshold = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: sources } = await client
    .from("calendar_sources")
    .select("id, organization_id, ics_url, last_synced_at")
    .eq("is_active", true);

  const due = (sources || []).filter(
    (s: any) => !s.last_synced_at || s.last_synced_at < threshold
  );

  const results: any[] = [];
  for (const source of due) {
    results.push(await syncOne(client, source));
  }

  try {
    await client.from("audit_log").insert({
      organization_id: null,
      user_id: null,
      action: "calendar.synced",
      metadata: {
        source_count: due.length,
        success_count: results.filter((r) => r.success).length,
        fail_count: results.filter((r) => !r.success).length,
      },
    });
  } catch {
    // audit best-effort
  }

  return new Response(
    JSON.stringify({ processed: due.length, results }, null, 2),
    { headers: { "content-type": "application/json" } }
  );
});
