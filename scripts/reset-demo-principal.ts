/**
 * Fusion Cell — demo reset script.
 *
 * Usage:
 *   npx tsx scripts/reset-demo-principal.ts <orgId>
 *
 * Deletes a seeded demo org and every dependent row in FK-safe order,
 * then removes the two demo auth users identified by their stored
 * "demo-admin-" / "demo-principal-" email prefix.
 *
 * Safe to run on a non-seeded org — missing tables / rows are tolerated.
 */

import { config as loadEnv } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

async function safeDelete(
  db: SupabaseClient,
  table: string,
  column: string,
  orgId: string
) {
  const { error } = await db.from(table).delete().eq(column, orgId);
  if (error) {
    // Missing table is fine; log everything else.
    const msg = String(error.message || "");
    if (!msg.includes("does not exist") && !msg.includes("relation")) {
      console.warn(`  (${table}) ${msg}`);
    }
  }
}

async function reset(db: SupabaseClient, orgId: string) {
  console.log(`→ Resetting org ${orgId}`);

  // Resolve member user_ids so we can delete the demo auth users afterward.
  const { data: members } = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId);
  const memberIds = (members || []).map(
    (m: { user_id: string }) => m.user_id
  );

  // Collect travel + brief IDs for table-level cleanup that doesn't key on org directly.
  const { data: itins } = await db
    .from("travel_itineraries")
    .select("id")
    .eq("organization_id", orgId);
  const itinIds = (itins || []).map((t: { id: string }) => t.id);

  const { data: briefs } = await db
    .from("briefs")
    .select("id")
    .eq("organization_id", orgId);
  const briefIds = (briefs || []).map((b: { id: string }) => b.id);

  const { data: budgets } = await db
    .from("budgets")
    .select("id")
    .eq("organization_id", orgId);
  const budgetIds = (budgets || []).map((b: { id: string }) => b.id);

  const { data: messages } = await db
    .from("messages")
    .select("id")
    .eq("organization_id", orgId);
  const messageIds = (messages || []).map((m: { id: string }) => m.id);

  const { data: blocks } = await db
    .from("project_blocks")
    .select("id");
  // Not strictly scoped to org — ON DELETE CASCADE from assets handles this. Skip.
  void blocks;

  // Cascade-heavy children first.
  if (itinIds.length > 0) {
    await db.from("travel_documents").delete().in("itinerary_id", itinIds);
    await db.from("travel_legs").delete().in("itinerary_id", itinIds);
  }
  await safeDelete(db, "travel_itineraries", "organization_id", orgId);

  await safeDelete(db, "calendar_events_cache", "organization_id", orgId);
  await safeDelete(db, "calendar_sources", "organization_id", orgId);

  await safeDelete(db, "principal_module_config", "organization_id", orgId);

  if (messageIds.length > 0) {
    await db.from("message_responses").delete().in("message_id", messageIds);
  }
  await safeDelete(db, "messages", "organization_id", orgId);

  if (briefIds.length > 0) {
    await db.from("brief_blocks").delete().in("brief_id", briefIds);
  }
  await safeDelete(db, "briefs", "organization_id", orgId);

  await safeDelete(db, "bills", "organization_id", orgId);

  if (budgetIds.length > 0) {
    await db.from("budget_line_items").delete().in("budget_id", budgetIds);
  }
  await safeDelete(db, "budgets", "organization_id", orgId);

  // project_contacts (scoped by organization_id)
  await safeDelete(db, "project_contacts", "organization_id", orgId);
  // project_blocks cascade when assets are deleted, but some demo rows may
  // remain if assets were deleted first — explicit cleanup:
  await safeDelete(db, "project_blocks", "organization_id", orgId);

  // assets
  await safeDelete(db, "assets", "organization_id", orgId);

  // memberships
  await safeDelete(db, "organization_members", "organization_id", orgId);

  // client profile
  await safeDelete(db, "client_profiles", "organization_id", orgId);

  // organization
  await safeDelete(db, "organizations", "id", orgId);

  // Auth users — only delete ones matching the demo prefix.
  if (memberIds.length > 0) {
    for (const uid of memberIds) {
      const { data: user } = await db.auth.admin.getUserById(uid);
      const email = user?.user?.email || "";
      if (
        email.startsWith("demo-admin-") ||
        email.startsWith("demo-principal-")
      ) {
        const { error } = await db.auth.admin.deleteUser(uid);
        if (error) {
          console.warn(`  (auth ${email}) ${error.message}`);
        }
      }
    }
    // Also remove the profile rows (no ON DELETE cascade from organization_members)
    await db.from("profiles").delete().in("id", memberIds);
  }

  console.log("✓ Reset complete.");
}

(async () => {
  const orgId = process.argv[2]?.trim();
  if (!orgId) {
    console.error("Usage: npx tsx scripts/reset-demo-principal.ts <orgId>");
    process.exit(1);
  }
  const db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });
  try {
    await reset(db, orgId);
  } catch (err) {
    console.error("Reset failed:", err);
    process.exit(1);
  }
})();
