/**
 * ICS fetch + parse helper.
 *
 * We use node-ical for the heavy lifting (VEVENT parsing + RRULE support)
 * and flatten the result into a lightweight ParsedEvent list scoped to a
 * lookback/lookahead window.
 *
 * Recurring events: node-ical returns a `rrule` property per VEVENT when
 * one is present. We call rrule.between(windowStart, windowEnd) to expand
 * occurrences; each expanded instance becomes its own ParsedEvent with
 * `uid` suffixed by the ISO start time so upserts into the cache dedupe
 * correctly across polls.
 */

// node-ical transitively pulls packages that touch BigInt at module-init,
// which breaks Next.js' static page-data collection. Lazy-require it inside
// the function so the server bundle only loads it at request time.

export interface ParsedEvent {
  uid: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  isAllDay: boolean;
  raw: Record<string, unknown>;
}

export interface FetchAndParseOptions {
  lookbackDays?: number;
  lookaheadDays?: number;
  timeoutMs?: number;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/calendar, */*;q=0.1" },
    });
    if (!res.ok) {
      throw new Error(`ICS fetch failed: HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAndParseICS(
  url: string,
  options: FetchAndParseOptions = {}
): Promise<ParsedEvent[]> {
  const { lookbackDays = 30, lookaheadDays = 90, timeoutMs = 10_000 } = options;

  const text = await fetchText(url, timeoutMs);
  // Lazy import — see note above the (removed) top-level import.
  const ical = await import("node-ical");
  // node-ical's async wrapper; cast to any because the library's TS types
  // are loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = (ical as any).parseICS(text) as Record<string, any>;

  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  const results: ParsedEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== "VEVENT") continue;

    const baseUid: string =
      ev.uid || ev.UID || `${ev.summary ?? "event"}-${key}`;

    if (ev.rrule) {
      // Recurring: expand within window
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const occurrences: Date[] = ev.rrule.between(
        windowStart,
        windowEnd,
        true
      );
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

    // Window filter
    if (start > windowEnd) continue;
    if ((end ?? start) < windowStart) continue;

    results.push(toEvent(ev, baseUid, start, end));
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(ev: any, uid: string, start: Date, end: Date | null): ParsedEvent {
  const isAllDay = Boolean(
    ev.datetype === "date" ||
      (ev.start && typeof ev.start.dateOnly === "boolean" && ev.start.dateOnly)
  );
  return {
    uid,
    title: ev.summary ?? null,
    description: ev.description ?? null,
    location: ev.location ?? null,
    start,
    end,
    isAllDay,
    raw: {
      status: ev.status ?? null,
      organizer: ev.organizer ?? null,
      categories: ev.categories ?? null,
      url: ev.url ?? null,
    },
  };
}
