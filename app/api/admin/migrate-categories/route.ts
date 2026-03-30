import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership?.role !== "admin" && membership?.role !== "owner") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 501 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const results: string[] = [];

  try {
    // 1. Add the allowed_categories column (via RPC or direct SQL isn't available via supabase-js,
    //    so we use the approach of just updating — the column must already exist from the SQL migration)
    //    If it doesn't exist yet, user needs to run 012_allowed_categories.sql first.

    // 2. Set Traust to business-only
    const { error: traustError } = await adminClient
      .from("client_profiles")
      .update({ allowed_categories: ["business"] })
      .eq("organization_id", "d0000000-0000-0000-0000-000000000001");

    if (traustError) {
      results.push(`Traust update failed: ${traustError.message}`);
    } else {
      results.push("Traust allowed_categories set to ['business']");
    }

    // 3. Ensure all other profiles have the default
    const { error: defaultError } = await adminClient
      .from("client_profiles")
      .update({ allowed_categories: ["business", "personal", "family"] })
      .neq("organization_id", "d0000000-0000-0000-0000-000000000001")
      .is("allowed_categories", null);

    if (defaultError) {
      results.push(`Default backfill failed: ${defaultError.message}`);
    } else {
      results.push("Other profiles backfilled with default categories");
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
