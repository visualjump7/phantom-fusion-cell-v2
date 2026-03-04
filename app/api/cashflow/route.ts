import { NextResponse } from "next/server";
import { generateDemoCashFlowData, getCashFlowForRange } from "@/lib/cashflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const data = generateDemoCashFlowData();

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
