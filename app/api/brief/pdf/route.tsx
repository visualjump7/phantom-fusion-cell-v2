import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { BriefPDF } from "@/components/brief/BriefPDF";
import type {
  Brief,
  BriefBlock,
  CashFlowBlockData,
  BillBlockData,
  ProjectsBlockData,
  DecisionsBlockData,
} from "@/lib/brief-service";
import { fetchCalendarData } from "@/lib/brief-service";

export async function POST(request: Request) {
  const cookieStore = cookies();

  // Auth client from session cookies
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

  // Verify caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role — admin or manager only
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const callerRole = membership?.role;
  if (!callerRole || !["admin", "owner", "manager", "accountant"].includes(callerRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Parse request
  const { briefId } = await request.json();
  if (!briefId) {
    return NextResponse.json({ error: "Missing briefId" }, { status: 400 });
  }

  // Use service role key if available, else fall back to user session
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db: any = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : supabase;

  // Fetch brief with blocks
  const { data: briefData, error: briefError } = await db
    .from("briefs")
    .select("*, brief_blocks(*)")
    .eq("id", briefId)
    .single();

  if (briefError || !briefData) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  const blocks = (briefData.brief_blocks || []).sort(
    (a: BriefBlock, b: BriefBlock) => a.position - b.position
  );
  const brief: Brief = { ...briefData, blocks, brief_blocks: undefined };

  // Fetch client profile for principal name
  const { data: clientProfile } = await db
    .from("client_profiles")
    .select("display_name")
    .eq("organization_id", brief.organization_id)
    .single();

  const principalName = clientProfile?.display_name || undefined;

  // Fetch live data for data blocks
  const orgId = brief.organization_id;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];
  const monthName = now.toLocaleString("default", { month: "long" });
  const today = now.toISOString().split("T")[0];

  // Cash flow
  const { data: monthBills } = await db
    .from("bills")
    .select("amount_cents, status")
    .eq("organization_id", orgId)
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd);

  const allBills = monthBills || [];
  const paid = allBills.filter((b: any) => b.status === "paid");
  const pending = allBills.filter((b: any) => b.status === "pending");
  const cashOut = paid.reduce((s: number, b: any) => s + b.amount_cents, 0);
  const pendingTotal = pending.reduce((s: number, b: any) => s + b.amount_cents, 0);

  const cashflow: CashFlowBlockData = {
    month: monthName,
    year,
    cashIn: 0,
    cashOut,
    net: -(cashOut + pendingTotal),
    paidCount: paid.length,
    pendingCount: pending.length,
  };

  // Bills for each days_ahead variant
  async function fetchBillsForDays(days: number): Promise<BillBlockData> {
    const future = new Date();
    future.setDate(future.getDate() + days);
    const endDate = future.toISOString().split("T")[0];
    const { data } = await db
      .from("bills")
      .select("id, title, amount_cents, due_date, status, assets:asset_id(name)")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .gte("due_date", today)
      .lte("due_date", endDate)
      .order("due_date", { ascending: true });

    const bills = (data || []).map((b: any) => ({
      id: b.id, title: b.title, amount_cents: b.amount_cents,
      due_date: b.due_date, asset_name: b.assets?.name || null, status: b.status,
    }));
    return { bills, total: bills.reduce((s: number, b: any) => s + b.amount_cents, 0), daysAhead: days };
  }

  const [bills7, bills14, bills30] = await Promise.all([
    fetchBillsForDays(7), fetchBillsForDays(14), fetchBillsForDays(30),
  ]);

  // Projects
  const { data: assetsData } = await db
    .from("assets")
    .select("id, name, category, estimated_value")
    .eq("organization_id", orgId)
    .eq("is_deleted", false)
    .order("estimated_value", { ascending: false });

  const projects: ProjectsBlockData = {
    projects: assetsData || [],
    totalValue: (assetsData || []).reduce((s: number, h: any) => s + (h.estimated_value || 0), 0),
    category: null,
  };

  // Decisions
  const { data: decisionMsgs } = await db
    .from("messages")
    .select("id, title, priority, due_date, created_at")
    .eq("organization_id", orgId)
    .eq("type", "decision")
    .eq("is_deleted", false)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const allDecisions = decisionMsgs || [];
  let pendingDecisions = allDecisions;
  if (allDecisions.length > 0) {
    const { data: responses } = await db
      .from("message_responses")
      .select("message_id")
      .in("message_id", allDecisions.map((d: any) => d.id));
    const respondedIds = new Set((responses || []).map((r: any) => r.message_id));
    pendingDecisions = allDecisions.filter((d: any) => !respondedIds.has(d.id));
  }

  const decisions: DecisionsBlockData = { decisions: pendingDecisions, count: pendingDecisions.length };

  // Calendar — only fetch the windows actually used by calendar blocks to
  // avoid an unnecessary triple-fetch when the brief has no calendar block.
  const calendarWindows = new Set<number>();
  for (const b of brief.blocks || []) {
    if (b.type === "calendar") {
      const days = Number(b.config?.days_ahead) || 7;
      calendarWindows.add(days);
    }
  }
  const calendarEntries = await Promise.all(
    Array.from(calendarWindows).map(async (days) => {
      const cal = await fetchCalendarData(orgId, days);
      return [`calendar_${days}`, cal] as const;
    })
  );

  const liveData: Record<string, any> = {
    cashflow,
    bills_7: bills7, bills_14: bills14, bills_30: bills30,
    projects, decisions,
    ...Object.fromEntries(calendarEntries),
  };

  // Render PDF
  const pdfElement = React.createElement(BriefPDF, { brief, liveData, principalName });
  const pdfBuffer = await renderToBuffer(pdfElement as any);

  const coverTitle = brief.cover_title || brief.title || "Daily-Brief";
  const safeTitle = coverTitle.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
  const filename = `${safeTitle}-${brief.brief_date}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
