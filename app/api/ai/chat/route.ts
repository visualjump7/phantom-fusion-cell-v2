import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Fetch data snapshot from Supabase for AI context
async function fetchDataSnapshot(supabaseUrl: string, supabaseKey: string) {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  const fetchTable = async (query: string) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers });
    if (!res.ok) return [];
    return res.json();
  };

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    const next14 = new Date(now.getTime() + 14 * 86400000)
      .toISOString()
      .split("T")[0];

    const [assets, pendingBills, upcomingBills, messages, unreadCount] =
      await Promise.all([
        fetchTable(
          "assets?is_deleted=eq.false&select=id,name,category,estimated_value&order=estimated_value.desc"
        ),
        fetchTable(
          `bills?status=eq.pending&due_date=gte.${monthStart}&due_date=lte.${monthEnd}&select=title,amount_cents,due_date,category,asset_id`
        ),
        fetchTable(
          `bills?status=eq.pending&due_date=gte.${today}&due_date=lte.${next14}&select=title,amount_cents,due_date,category,payee&order=due_date.asc&limit=10`
        ),
        fetchTable(
          "messages?is_deleted=eq.false&is_archived=eq.false&select=id,title,type,priority,asset_id,created_at&order=created_at.desc&limit=10"
        ),
        fetchTable(
          "messages?is_deleted=eq.false&is_archived=eq.false&select=id&limit=100"
        ),
      ]);

    // Calculate totals
    const totalPortfolioValue = (assets || []).reduce(
      (sum: number, a: { estimated_value: number | null }) =>
        sum + (a.estimated_value || 0),
      0
    );

    const totalDueThisMonth = (pendingBills || []).reduce(
      (sum: number, b: { amount_cents: number }) => sum + b.amount_cents,
      0
    );

    // Build asset lookup for bill context
    const assetMap = new Map(
      (assets || []).map((a: { id: string; name: string }) => [a.id, a.name])
    );

    // Format upcoming bills with asset names
    const upcomingFormatted = (upcomingBills || []).map(
      (b: {
        title: string;
        amount_cents: number;
        due_date: string;
        category: string | null;
        payee: string | null;
      }) => ({
        title: b.title,
        amount: `$${Math.round(b.amount_cents / 100).toLocaleString()}`,
        due: b.due_date,
        category: b.category,
        payee: b.payee,
      })
    );

    // Count messages needing action
    const decisionsNeeded = (messages || []).filter(
      (m: { type: string }) =>
        m.type === "decision" || m.type === "action_required"
    ).length;

    return {
      totalPortfolioValue: `$${Math.round(totalPortfolioValue).toLocaleString()}`,
      assetCount: (assets || []).length,
      assets: (assets || []).map(
        (a: {
          id: string;
          name: string;
          category: string;
          estimated_value: number;
        }) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          value: `$${Math.round(a.estimated_value || 0).toLocaleString()}`,
        })
      ),
      monthlyBills: {
        count: (pendingBills || []).length,
        total: `$${Math.round(totalDueThisMonth / 100).toLocaleString()}`,
      },
      upcoming14Days: upcomingFormatted,
      messages: {
        total: (messages || []).length,
        decisionsNeeded,
        recent: (messages || [])
          .slice(0, 5)
          .map((m: { title: string; type: string; priority: string }) => ({
            title: m.title,
            type: m.type,
            priority: m.priority,
          })),
      },
    };
  } catch (error) {
    console.error("Error fetching data snapshot:", error);
    return null;
  }
}

function buildSystemPrompt(snapshot: any): string {
  return `You are the Fusion Cell AI assistant for a high-net-worth individual. You help them navigate their financial overview quickly and find the information they need.

CURRENT DATA SNAPSHOT:
- Portfolio Value: ${snapshot.totalPortfolioValue} across ${snapshot.assetCount} assets
- Assets: ${snapshot.assets.map((a: any) => `${a.name} (${a.category}, ${a.value})`).join(", ")}
- Bills due this month: ${snapshot.monthlyBills.count} bills totaling ${snapshot.monthlyBills.total}
- Upcoming 14 days: ${snapshot.upcoming14Days.length > 0 ? snapshot.upcoming14Days.map((b: any) => `${b.title} — ${b.amount} on ${b.due}`).join("; ") : "No upcoming bills"}
- Messages: ${snapshot.messages.total} active, ${snapshot.messages.decisionsNeeded} decisions/actions needed

NAVIGATION LINKS (include these when relevant):
- Dashboard: /
- All Assets: /assets
- Specific asset: /assets/[asset-id] (use actual IDs from the asset list above)
- Fiscal Calendar: /calendar
- Messages: /messages
- Settings: /settings

ASSET IDS FOR DEEP LINKS:
${snapshot.assets.map((a: any) => `- ${a.name}: /assets/${a.id}`).join("\n")}

RULES:
1. Be concise and direct. This person values their time.
2. Use clear dollar amounts, not jargon.
3. When mentioning an asset, bill, or message, include a navigation link in markdown format: [Link Text](/path)
4. If asked about something not in the data, say so honestly.
5. Format currency consistently: $1,234,567
6. Keep responses under 150 words unless the question requires detail.
7. If asked "what should I look at" or similar, prioritize: decisions needing action > overdue bills > high-priority messages > upcoming large payments.`;
}

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI assistant not configured. Add ANTHROPIC_API_KEY to environment." },
      { status: 500 }
    );
  }

  try {
    const { messages, conversationHistory } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    // Fetch live data for context
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const snapshot = await fetchDataSnapshot(supabaseUrl, supabaseKey);

    if (!snapshot) {
      return NextResponse.json(
        { error: "Failed to fetch data context" },
        { status: 500 }
      );
    }

    const systemPrompt = buildSystemPrompt(snapshot);

    // Build conversation for Claude
    const claudeMessages = [
      ...(conversationHistory || []),
      ...messages,
    ].map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      return NextResponse.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const assistantMessage =
      data.content?.[0]?.text || "I couldn't process that request.";

    return NextResponse.json({
      message: assistantMessage,
      role: "assistant",
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "An error occurred processing your request" },
      { status: 500 }
    );
  }
}
