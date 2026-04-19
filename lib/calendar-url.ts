/**
 * Calendar URL helpers shared by the client form and the server-side fetch.
 * Kept in a standalone file so client bundles don't pull in node-ical
 * (which lives in calendar-ics.ts).
 */

/**
 * Normalize calendar feed URLs so the runtime fetch can handle them.
 * `webcal://` and `webcals://` are aliases Apple/Outlook hand out to trigger
 * the OS's native calendar app — they aren't real network protocols and
 * Node's fetch will reject them. They map 1:1 to https://.
 */
export function normalizeIcsUrl(url: string): string {
  const trimmed = url.trim();
  if (/^webcals:\/\//i.test(trimmed)) {
    return "https://" + trimmed.slice("webcals://".length);
  }
  if (/^webcal:\/\//i.test(trimmed)) {
    return "https://" + trimmed.slice("webcal://".length);
  }
  return trimmed;
}
