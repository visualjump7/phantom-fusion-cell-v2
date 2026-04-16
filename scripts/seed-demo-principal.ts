/**
 * Fusion Cell — demo seed script.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-principal.ts "<Org Name>"
 *
 * Creates a fresh demo organization with a demo admin + demo principal
 * user, all 9 modules enabled, 8 holdings, budgets, bills, decisions,
 * daily briefs, contacts, and a 4-leg travel itinerary. Prints the
 * generated credentials on success.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * the environment (loaded via .env.local by default).
 */

import { config as loadEnv } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv(); // fallback to .env

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const ALL_MODULE_KEYS = [
  "dashboard",
  "daily_brief",
  "comms",
  "travel",
  "budgets",
  "cash_flow",
  "projects",
  "contacts",
  "calendar",
];

function randomPassword(): string {
  return randomBytes(9).toString("base64url");
}

function log(step: string) {
  console.log(`→ ${step}`);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function dateOnly(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function must<T>(
  label: string,
  promise: Promise<{ data: T | null; error: unknown }>
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    console.error(`  ✗ ${label}:`, error);
    process.exit(1);
  }
  if (data === null || data === undefined) {
    console.error(`  ✗ ${label}: no data returned`);
    process.exit(1);
  }
  return data;
}

async function seed(db: SupabaseClient, orgName: string) {
  const ts = Math.floor(Date.now() / 1000);
  const adminEmail = `demo-admin-${ts}@example.com`;
  const principalEmail = `demo-principal-${ts}@example.com`;
  const adminPw = randomPassword();
  const principalPw = randomPassword();

  // 1) Organization
  log("Creating organization");
  const org = await must<{ id: string }>(
    "organization",
    db
      .from("organizations")
      .insert({ name: orgName })
      .select("id")
      .single() as any
  );

  // 2) Client profile
  log("Creating client profile");
  await db.from("client_profiles").insert({
    organization_id: org.id,
    display_name: orgName,
    accent_color: "green",
    status: "active",
  });

  // 3) Auth users
  log("Creating demo admin user");
  const { data: adminAuth, error: adminErr } = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPw,
    email_confirm: true,
    user_metadata: { full_name: "Demo Admin" },
  });
  if (adminErr || !adminAuth?.user) {
    console.error("  ✗ admin user:", adminErr);
    process.exit(1);
  }
  const adminId = adminAuth.user.id;

  log("Creating demo principal user");
  const { data: pAuth, error: pErr } = await db.auth.admin.createUser({
    email: principalEmail,
    password: principalPw,
    email_confirm: true,
    user_metadata: { full_name: "Demo Principal" },
  });
  if (pErr || !pAuth?.user) {
    console.error("  ✗ principal user:", pErr);
    process.exit(1);
  }
  const principalId = pAuth.user.id;

  // 4) Profiles
  log("Upserting profiles");
  await db.from("profiles").upsert([
    {
      id: adminId,
      email: adminEmail,
      full_name: "Demo Admin",
      status: "active",
      has_seen_welcome: true,
    },
    {
      id: principalId,
      email: principalEmail,
      full_name: "Demo Principal",
      status: "active",
      has_seen_welcome: false,
    },
  ]);

  // 5) Memberships
  log("Attaching members");
  await db.from("organization_members").insert([
    { organization_id: org.id, user_id: adminId, role: "admin", status: "active" },
    { organization_id: org.id, user_id: principalId, role: "executive", status: "active" },
  ]);

  // 6) Module config — all 9 modules visible for demo
  log("Seeding module visibility");
  await db.from("principal_module_config").upsert(
    ALL_MODULE_KEYS.map((key, idx) => ({
      organization_id: org.id,
      principal_id: principalId,
      module_key: key,
      is_visible: true,
      position: idx,
      updated_by: adminId,
    })),
    { onConflict: "organization_id,principal_id,module_key" }
  );

  // 7) Holdings
  log("Creating 8 holdings");
  const holdingsSeed = [
    { name: "Gulfstream G650", category: "business", estimated_value: 72_000_000 },
    { name: "M/Y Wayfinder", category: "personal", estimated_value: 85_000_000 },
    { name: "Aspen Residence", category: "personal", estimated_value: 28_500_000 },
    { name: "Manhattan Penthouse", category: "personal", estimated_value: 42_000_000 },
    { name: "Palm Beach Estate", category: "family", estimated_value: 58_000_000 },
    { name: "1962 Ferrari 250 GTO", category: "personal", estimated_value: 48_000_000 },
    { name: "Modern Art Collection", category: "family", estimated_value: 120_000_000 },
    { name: "Family Office Holdings LLC", category: "business", estimated_value: 220_000_000 },
  ];
  const { data: assets } = await db
    .from("assets")
    .insert(
      holdingsSeed.map((h) => ({
        organization_id: org.id,
        name: h.name,
        category: h.category,
        estimated_value: h.estimated_value,
        status: "active",
      }))
    )
    .select("id, name");

  if (!assets || assets.length === 0) {
    console.error("  ✗ holdings: no rows returned");
    process.exit(1);
  }
  const byName = new Map<string, string>(
    assets.map((a: { id: string; name: string }) => [a.name, a.id])
  );

  // 8) Budgets + line items
  log("Creating budgets + line items");
  const year = new Date().getFullYear();
  const budgetRows = await must<{ id: string; asset_id: string }[]>(
    "budgets insert",
    db
      .from("budgets")
      .insert(
        assets.map((a: { id: string }) => ({
          organization_id: org.id,
          asset_id: a.id,
          year,
        }))
      )
      .select("id, asset_id") as any
  );

  // Expense categories — seed a few if missing, then reuse IDs
  const seedCats = [
    { name: "Insurance", color: "#3b82f6" },
    { name: "Maintenance", color: "#10b981" },
    { name: "Fuel", color: "#f59e0b" },
    { name: "Crew", color: "#8b5cf6" },
  ];
  const { data: existingCats } = await db.from("expense_categories").select("id, name");
  const catByName = new Map<string, string>(
    (existingCats || []).map((c: { id: string; name: string }) => [c.name, c.id])
  );
  const missing = seedCats.filter((c) => !catByName.has(c.name));
  if (missing.length > 0) {
    const { data: inserted } = await db
      .from("expense_categories")
      .insert(missing)
      .select("id, name");
    (inserted || []).forEach((c: { id: string; name: string }) => catByName.set(c.name, c.id));
  }

  const insuranceId = catByName.get("Insurance")!;
  const maintId = catByName.get("Maintenance")!;
  const fuelId = catByName.get("Fuel")!;
  const crewId = catByName.get("Crew")!;

  const lineItems: any[] = [];
  for (const b of budgetRows) {
    // 3 line items per budget with varying monthly amounts
    const scale = Math.floor(5_000 + Math.random() * 50_000);
    lineItems.push(
      {
        budget_id: b.id,
        expense_category_id: insuranceId,
        description: "Annual insurance",
        jan: scale, feb: scale, mar: scale, apr: scale, may: scale, jun: scale,
        jul: scale, aug: scale, sep: scale, oct: scale, nov: scale, dec: scale,
        annual_total: scale * 12,
      },
      {
        budget_id: b.id,
        expense_category_id: maintId,
        description: "Scheduled maintenance",
        jan: 0, feb: scale, mar: 0, apr: 0, may: scale * 2, jun: 0,
        jul: 0, aug: scale, sep: 0, oct: 0, nov: scale * 2, dec: 0,
        annual_total: scale * 6,
      },
      {
        budget_id: b.id,
        expense_category_id: fuelId,
        description: "Fuel + operating",
        jan: scale, feb: scale, mar: scale, apr: scale, may: scale, jun: scale,
        jul: scale, aug: scale, sep: scale, oct: scale, nov: scale, dec: scale,
        annual_total: scale * 12,
      }
    );
  }
  await db.from("budget_line_items").insert(lineItems);

  // 9) Bills — 30 across next 60 days
  log("Creating 30 bills");
  const billRows: any[] = [];
  for (let i = 0; i < 30; i++) {
    const asset = assets[i % assets.length];
    const days = i * 2; // spread 0..58
    const paid = i % 5 === 0; // ~20% paid
    billRows.push({
      organization_id: org.id,
      asset_id: asset.id,
      title: `${["Fuel", "Insurance", "Dockage", "Hangar", "Utilities", "Staff"][i % 6]} — ${asset.name}`,
      amount_cents: (5_000 + ((i * 731) % 95_000)) * 100,
      due_date: dateOnly(days),
      payee: ["NetJets", "Marsh McLennan", "BoatUS", "Signature", "Con Edison", "ADP"][i % 6],
      category: "operations",
      status: paid ? "paid" : "pending",
    });
  }
  await db.from("bills").insert(billRows);

  // 10) Messages — 3 pending decisions + 2 confirmed + 4 informational
  log("Creating messages");
  const gulfstreamId = byName.get("Gulfstream G650");
  const aspenId = byName.get("Aspen Residence");
  const artId = byName.get("Modern Art Collection");

  const { data: msgInsert } = await db
    .from("messages")
    .insert([
      {
        organization_id: org.id,
        sender_id: adminId,
        asset_id: gulfstreamId,
        type: "decision",
        priority: "high",
        title: "Gulfstream G650 insurance renewal",
        body: "Marsh has quoted $420,000 for 2026 coverage, a 6% increase year-over-year. Approve to bind by Friday.",
        due_date: daysFromNow(5),
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        asset_id: aspenId,
        type: "decision",
        priority: "medium",
        title: "Aspen kitchen renovation — vendor selection",
        body: "Three bids attached, ranging $180K–$265K. We recommend Vendor B ($215K) based on prior work at Palm Beach. Your approval required to proceed.",
        due_date: daysFromNow(8),
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        asset_id: artId,
        type: "decision",
        priority: "urgent",
        title: "Basquiat acquisition — pre-emptive offer",
        body: "Gagosian has a private listing at $28M. Acquisition committee recommends proceeding. Window closes in 72 hours.",
        due_date: daysFromNow(3),
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        type: "decision",
        priority: "medium",
        title: "Q1 operating budget sign-off",
        body: "Final Q1 operating budget attached. $4.8M consolidated across all holdings.",
        due_date: daysFromNow(-2),
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        type: "decision",
        priority: "low",
        title: "Property manager hire — Palm Beach",
        body: "New property manager candidate identified. References checked. Ready to extend offer.",
        due_date: daysFromNow(-5),
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        type: "alert",
        priority: "high",
        title: "Yacht hurricane prep — M/Y Wayfinder",
        body: "Captain has moved the vessel to the designated hurricane hole. No action required.",
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        type: "update",
        priority: "low",
        title: "Ferrari 250 GTO maintenance complete",
        body: "Annual service complete at the concours shop. Vehicle returning Tuesday.",
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        type: "update",
        priority: "low",
        title: "Art insurance appraisal refreshed",
        body: "Annual appraisal cycle complete. Coverage limits adjusted to reflect market values.",
      },
      {
        organization_id: org.id,
        sender_id: adminId,
        type: "alert",
        priority: "medium",
        title: "Aspen HVAC quarterly service scheduled",
        body: "HVAC provider booked for Thursday morning.",
      },
    ])
    .select("id, type, due_date");

  // Mark the two backdated decisions as confirmed via message_responses
  if (msgInsert) {
    const confirmed = msgInsert
      .filter((m: any) => m.type === "decision" && m.due_date && m.due_date < new Date().toISOString())
      .slice(0, 2);
    if (confirmed.length > 0) {
      await db.from("message_responses").insert(
        confirmed.map((m: any) => ({
          message_id: m.id,
          user_id: principalId,
          response_type: "approved",
          comment: "Approved.",
          confirmed_at: new Date().toISOString(),
          confirmed_by: adminId,
        }))
      );
    }
  }

  // 11) Daily briefs — today + yesterday, 3 blocks each
  log("Creating daily briefs");
  for (const offset of [0, -1]) {
    const { data: brief } = await db
      .from("briefs")
      .insert({
        organization_id: org.id,
        title: offset === 0 ? "Today's Brief" : "Yesterday's Brief",
        brief_date: dateOnly(offset),
        status: "published",
        published_at: new Date().toISOString(),
        published_by: adminId,
        created_by: adminId,
      })
      .select("id")
      .single();
    if (brief) {
      await db.from("brief_blocks").insert([
        {
          brief_id: brief.id,
          type: "text",
          position: 0,
          content_html:
            "<h2>Overview</h2><p>Three decisions awaiting your review, one time-sensitive. All operational systems nominal across holdings.</p>",
        },
        {
          brief_id: brief.id,
          type: "decisions",
          position: 1,
          commentary: "Gulfstream renewal is the priority — Marsh needs an answer by Friday.",
        },
        {
          brief_id: brief.id,
          type: "bills",
          position: 2,
          config: { days_ahead: 7 },
          commentary: "No overdue items. One sizable bill due next week (Ferrari restoration installment).",
        },
      ]);
    }
  }

  // 12) Contacts — project blocks + global
  log("Creating contacts");
  // Create a small "Personnel" block on the first three holdings so contacts can hang off a block_id.
  const primaryAssets = assets.slice(0, 3);
  const blockRows = await must<{ id: string; asset_id: string }[]>(
    "project_blocks",
    db
      .from("project_blocks")
      .insert(
        primaryAssets.map((a: { id: string }) => ({
          asset_id: a.id,
          organization_id: org.id,
          type: "personnel",
          title: "Key Personnel",
          position: 0,
        }))
      )
      .select("id, asset_id") as any
  );
  const blockByAsset = new Map<string, string>(
    blockRows.map((b) => [b.asset_id, b.id])
  );

  const projectContactSeeds = [
    { assetName: "Gulfstream G650", name: "Captain James Mercer", role: "Chief Pilot", type: "personnel", category: "crew" },
    { assetName: "Gulfstream G650", name: "Sarah Okonkwo", role: "First Officer", type: "personnel", category: "crew" },
    { assetName: "Gulfstream G650", name: "Avfuel Corporation", role: "Fuel Supplier", type: "subcontractor", category: "vendor" },
    { assetName: "Gulfstream G650", name: "Marsh McLennan", role: "Insurance Broker", type: "subcontractor", category: "broker" },
    { assetName: "M/Y Wayfinder", name: "Captain Ruby Lange", role: "Master", type: "personnel", category: "crew" },
    { assetName: "M/Y Wayfinder", name: "Chief Engineer Peralta", role: "Chief Engineer", type: "personnel", category: "crew" },
    { assetName: "M/Y Wayfinder", name: "IYC Management", role: "Yacht Manager", type: "subcontractor", category: "property_manager" },
    { assetName: "Aspen Residence", name: "Mountain Estate Co", role: "Property Manager", type: "subcontractor", category: "property_manager" },
    { assetName: "Aspen Residence", name: "Anna Vogt", role: "House Manager", type: "personnel", category: "household_staff" },
    { assetName: "Aspen Residence", name: "Silverpeak Security", role: "Security Provider", type: "subcontractor", category: "security" },
    { assetName: "Aspen Residence", name: "Aspen Alpine Medical", role: "Concierge Medicine", type: "subcontractor", category: "medical" },
    { assetName: "Aspen Residence", name: "Vendor B Construction", role: "Renovation GC", type: "subcontractor", category: "vendor" },
  ];

  const contactRows = projectContactSeeds.map((c) => {
    const assetId = byName.get(c.assetName)!;
    // If we don't have a block for this asset, leave block_id null (is_global remains false; the fetcher still surfaces it).
    const blockId = blockByAsset.get(assetId) ?? null;
    return {
      organization_id: org.id,
      block_id: blockId,
      contact_type: c.type,
      contact_category: c.category,
      is_global: false,
      name: c.name,
      role: c.role,
      status: "active",
      position: 0,
    };
  });
  await db.from("project_contacts").insert(contactRows);

  // Global contacts (block_id null, is_global true)
  await db.from("project_contacts").insert([
    {
      organization_id: org.id,
      block_id: null,
      is_global: true,
      contact_category: "attorney",
      name: "Foster, Chen & Partners",
      role: "Family Attorney",
      company_name: "Foster Chen",
      email: "reception@fcp.example",
      phone: "+1 212-555-0144",
      status: "active",
    },
    {
      organization_id: org.id,
      block_id: null,
      is_global: true,
      contact_category: "other",
      name: "Alma Westbrook CPA",
      role: "Family CPA",
      company_name: "Westbrook & Co",
      email: "alma@westbrook.example",
      phone: "+1 212-555-0189",
      status: "active",
    },
    {
      organization_id: org.id,
      block_id: null,
      is_global: true,
      contact_category: "medical",
      name: "Dr. Priya Ramakrishnan",
      role: "Primary Physician",
      company_name: "NYU Langone",
      phone: "+1 212-555-0123",
      status: "active",
    },
    {
      organization_id: org.id,
      block_id: null,
      is_global: true,
      contact_category: "security",
      name: "Marcus Hale",
      role: "Security Director",
      company_name: "Hale Protective",
      phone: "+1 646-555-0101",
      status: "active",
    },
  ]);

  // 13) Travel — 1 published itinerary with 4 legs + 2 docs
  log("Creating travel itinerary");
  const { data: itin } = await db
    .from("travel_itineraries")
    .insert({
      organization_id: org.id,
      principal_id: principalId,
      title: "Geneva Business Trip",
      trip_start: dateOnly(14),
      trip_end: dateOnly(18),
      status: "published",
      created_by: adminId,
    })
    .select("id")
    .single();

  if (itin) {
    await db.from("travel_legs").insert([
      {
        itinerary_id: itin.id,
        organization_id: org.id,
        leg_type: "flight",
        provider: "Gulfstream G650",
        departure_location: "Teterboro (KTEB)",
        departure_lat: 40.8501,
        departure_lng: -74.0608,
        arrival_location: "Geneva (LSGG)",
        arrival_lat: 46.2381,
        arrival_lng: 6.1089,
        departure_time: daysFromNow(14),
        arrival_time: daysFromNow(14).replace("T0", "T07"),
        position: 0,
      },
      {
        itinerary_id: itin.id,
        organization_id: org.id,
        leg_type: "hotel",
        provider: "Hôtel Beau-Rivage",
        confirmation_number: "HBR-4821",
        departure_location: "Geneva",
        departure_lat: 46.2075,
        departure_lng: 6.1515,
        departure_time: daysFromNow(14),
        arrival_time: daysFromNow(16),
        position: 1,
      },
      {
        itinerary_id: itin.id,
        organization_id: org.id,
        leg_type: "ground",
        provider: "Mercedes-Maybach S-Class",
        departure_location: "Geneva",
        departure_lat: 46.2044,
        departure_lng: 6.1432,
        arrival_location: "Zurich",
        arrival_lat: 47.3769,
        arrival_lng: 8.5417,
        departure_time: daysFromNow(16),
        arrival_time: daysFromNow(16),
        position: 2,
      },
      {
        itinerary_id: itin.id,
        organization_id: org.id,
        leg_type: "flight",
        provider: "Gulfstream G650",
        departure_location: "Zurich (LSZH)",
        departure_lat: 47.4647,
        departure_lng: 8.5492,
        arrival_location: "Teterboro (KTEB)",
        arrival_lat: 40.8501,
        arrival_lng: -74.0608,
        departure_time: daysFromNow(18),
        arrival_time: daysFromNow(18),
        position: 3,
      },
    ]);

    // Two placeholder documents — storage_path is a dummy string; download
    // will fail gracefully (this is demo-only visibility).
    await db.from("travel_documents").insert([
      {
        itinerary_id: itin.id,
        organization_id: org.id,
        title: "Charter Agreement — Geneva",
        document_type: "charter_agreement",
        storage_path: "demo/placeholder-charter.pdf",
        file_name: "charter.pdf",
        ai_accessible: true,
        uploaded_by: adminId,
      },
      {
        itinerary_id: itin.id,
        organization_id: org.id,
        title: "Hotel Confirmation — Beau-Rivage",
        document_type: "hotel_confirmation",
        storage_path: "demo/placeholder-hotel.pdf",
        file_name: "hotel-confirmation.pdf",
        ai_accessible: true,
        uploaded_by: adminId,
      },
    ]);
  }

  // Done
  console.log("");
  console.log("✓ Demo principal seeded.");
  console.log(`  Admin login:     ${adminEmail} / ${adminPw}`);
  console.log(`  Principal login: ${principalEmail} / ${principalPw}`);
  console.log(`  Org ID:          ${org.id}`);
  console.log(`  Run reset:       npx tsx scripts/reset-demo-principal.ts ${org.id}`);
  console.log("");
}

(async () => {
  const orgName = process.argv[2]?.trim() || "Demo Principal";
  const db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });
  try {
    await seed(db, orgName);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
