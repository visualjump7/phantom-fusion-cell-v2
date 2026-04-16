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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string };
  if (!body.sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const { syncSource } = createCalendarSync(supabase);
  const result = await syncSource(body.sourceId);

  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
