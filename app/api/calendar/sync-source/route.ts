/**
 * POST /api/calendar/sync-source
 *
 * Runs a single calendar-source sync on the server so the browser never
 * has to pull node-ical (Node built-ins) into its bundle. Auth verified
 * via the user's session cookie; the sync itself runs with the anon
 * client (RLS restricts access appropriately).
 *
 * Body: { sourceId: string }
 */

export const runtime = "nodejs";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCalendarSync } from "@/lib/calendar-sync-service";
import { requireOrgManager, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const auth = await requireUser(supabase);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string };
  if (!body.sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  // Look up the source's org so we can verify the caller is a manager of it.
  // Without this gate any authenticated user could trigger a sync of any
  // source they happen to know the id of, burning server CPU and hammering
  // the upstream ICS URL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceLookup = await (supabase as any)
    .from("calendar_sources")
    .select("organization_id")
    .eq("id", body.sourceId)
    .maybeSingle();
  const sourceOrgId = (sourceLookup.data as { organization_id?: string } | null)?.organization_id;
  if (!sourceOrgId) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  const gate = await requireOrgManager(supabase, sourceOrgId);
  if ("response" in gate) return gate.response;

  const { syncSource } = createCalendarSync(supabase);
  const result = await syncSource(body.sourceId);

  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
