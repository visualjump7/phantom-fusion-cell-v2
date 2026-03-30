import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  generateDemoCashFlowData,
  getCashFlowForRange,
  buildCashFlowFromBills,
  BillRow,
} from "@/lib/cashflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const orgId = searchParams.get("orgId");

    let data;

    if (orgId) {
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

      const { data: bills, error } = await supabase
        .from("bills")
        .select("id, title, amount_cents, due_date, status, payee, category")
        .eq("organization_id", orgId)
        .order("due_date", { ascending: true });

      if (!error && bills && bills.length > 0) {
        data = buildCashFlowFromBills(bills as BillRow[]);
      } else {
        data = generateDemoCashFlowData();
      }
    } else {
      data = generateDemoCashFlowData();
    }

    if (start && end) {
      const filtered = getCashFlowForRange(data.dailyEntries, start, end);
      return NextResponse.json(
        { ...data, dailyEntries: filtered },
        {
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
        }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch (error) {
    console.error("Cash flow API error:", error);
    return NextResponse.json(
      { error: "Failed to load cash flow data" },
      { status: 500 }
    );
  }
}
