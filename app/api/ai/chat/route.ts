import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function fetchComprehensiveSnapshot(supabaseUrl: string, supabaseKey: string) {
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
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const next30 = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];

    const [
      assets,
      allBillsThisMonth,
      upcomingBills,
      overdueBills,
      paidBillsThisMonth,
      messages,
      messageResponses,
      budgets,
      budgetLineItems,
    ] = await Promise.all([
      // All active assets with full detail
      fetchTable("assets?is_deleted=eq.false&select=id,name,category,estimated_value,description,status&order=estimated_value.desc"),
      // All pending bills this month
      fetchTable(`bills?status=eq.pending&due_date=gte.${monthStart}&due_date=lte.${monthEnd}&select=id,title,amount_cents,due_date,category,payee,asset_id,notes&order=due_date.asc`),
      // Upcoming 30 days
      fetchTable(`bills?status=eq.pending&due_date=gte.${today}&due_date=lte.${next30}&select=id,title,amount_cents,due_date,category,payee,asset_id&order=due_date.asc`),
      // Overdue
      fetchTable(`bills?status=eq.pending&due_date=lt.${today}&select=id,title,amount_cents,due_date,category,payee,asset_id`),
      // Paid this month
      fetchTable(`bills?status=eq.paid&due_date=gte.${monthStart}&due_date=lte.${monthEnd}&select=amount_cents`),
      // All active messages with full detail
      fetchTable("messages?is_deleted=eq.false&is_archived=eq.false&select=id,title,body,type,priority,asset_id,created_at&order=created_at.desc"),
      // All message responses
      fetchTable("message_responses?select=id,message_id,response_type,comment,created_at&order=created_at.desc"),
      // Budgets
      fetchTable("budgets?select=id,asset_id,year"),
      // Budget line items
      fetchTable("budget_line_items?select=id,budget_id,description,jan,feb,mar,apr,may,jun,jul,aug,sep,oct,dec,annual_total"),
    ]);

    // Build asset lookup
    const assetMap = new Map((assets || []).map((a: any) => [a.id, a.name]));

    // Calculate totals
    const totalPortfolioValue = (assets || []).reduce((s: number, a: any) => s + (a.estimated_value || 0), 0);
    const totalDueThisMonth = (allBillsThisMonth || []).reduce((s: number, b: any) => s + b.amount_cents, 0);
    const totalPaidThisMonth = (paidBillsThisMonth || []).reduce((s: number, b: any) => s + b.amount_cents, 0);
    const totalOverdue = (overdueBills || []).reduce((s: number, b: any) => s + b.amount_cents, 0);

    // Group bills by category
    const billsByCategory = new Map<string, { count: number; total: number }>();
    (allBillsThisMonth || []).forEach((b: any) => {
      const cat = b.category || "Uncategorized";
      const existing = billsByCategory.get(cat) || { count: 0, total: 0 };
      billsByCategory.set(cat, { count: existing.count + 1, total: existing.total + b.amount_cents });
    });

    // Group bills by asset
    const billsByAsset = new Map<string, { count: number; total: number }>();
    (upcomingBills || []).forEach((b: any) => {
      if (!b.asset_id) return;
      const name = assetMap.get(b.asset_id) || "Unknown";
      const existing = billsByAsset.get(name) || { count: 0, total: 0 };
      billsByAsset.set(name, { count: existing.count + 1, total: existing.total + b.amount_cents });
    });

    // Categorize messages
    const respondedMessageIds = new Set((messageResponses || []).map((r: any) => r.message_id));
    const pendingDecisions = (messages || []).filter(
      (m: any) => (m.type === "decision" || m.type === "action_required") && !respondedMessageIds.has(m.id)
    );
    const answeredDecisions = (messages || []).filter(
      (m: any) => (m.type === "decision" || m.type === "action_required") && respondedMessageIds.has(m.id)
    );
    const alerts = (messages || []).filter((m: any) => m.type === "alert");
    const updates = (messages || []).filter((m: any) => m.type === "update");

    // Build responses lookup
    const responseLookup = new Map<string, any>();
    (messageResponses || []).forEach((r: any) => {
      if (!responseLookup.has(r.message_id)) {
        responseLookup.set(r.message_id, r);
      }
    });

    // Budget summaries by asset
    const budgetSummaries: { assetName: string; year: number; annualTotal: number }[] = [];
    (budgets || []).forEach((budget: any) => {
      const assetName = assetMap.get(budget.asset_id) || "Unknown";
      const items = (budgetLineItems || []).filter((li: any) => li.budget_id === budget.id);
      const annualTotal = items.reduce((s: number, li: any) => s + (li.annual_total || 0), 0);
      if (annualTotal > 0) {
        budgetSummaries.push({ assetName, year: budget.year, annualTotal });
      }
    });

    const fmt = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;
    const fmtVal = (val: number) => `$${Math.round(val).toLocaleString()}`;

    return {
      portfolio: {
        totalValue: fmtVal(totalPortfolioValue),
        assetCount: (assets || []).length,
        assets: (assets || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          value: fmtVal(a.estimated_value || 0),
          description: a.description,
        })),
        byCategory: Object.entries(
          (assets || []).reduce((acc: any, a: any) => {
            acc[a.category] = (acc[a.category] || 0) + (a.estimated_value || 0);
            return acc;
          }, {})
        ).map(([cat, val]) => `${cat}: ${fmtVal(val as number)}`),
      },
      billing: {
        dueThisMonth: fmt(totalDueThisMonth),
        dueCount: (allBillsThisMonth || []).length,
        paidThisMonth: fmt(totalPaidThisMonth),
        overdueCount: (overdueBills || []).length,
        overdueTotal: fmt(totalOverdue),
        overdueBills: (overdueBills || []).map((b: any) => ({
          title: b.title,
          amount: fmt(b.amount_cents),
          dueDate: b.due_date,
          asset: assetMap.get(b.asset_id) || null,
        })),
        upcoming30Days: (upcomingBills || []).slice(0, 15).map((b: any) => ({
          title: b.title,
          amount: fmt(b.amount_cents),
          dueDate: b.due_date,
          category: b.category,
          payee: b.payee,
          asset: assetMap.get(b.asset_id) || null,
        })),
        byCategory: Array.from(billsByCategory.entries()).map(([cat, data]) => ({
          category: cat,
          count: data.count,
          total: fmt(data.total),
        })),
        byAsset: Array.from(billsByAsset.entries()).map(([name, data]) => ({
          asset: name,
          count: data.count,
          total: fmt(data.total),
        })),
      },
      messages: {
        total: (messages || []).length,
        pendingDecisions: pendingDecisions.map((m: any) => ({
          id: m.id,
          title: m.title,
          body: m.body,
          type: m.type,
          priority: m.priority,
          asset: assetMap.get(m.asset_id) || null,
        })),
        answeredDecisions: answeredDecisions.map((m: any) => {
          const resp = responseLookup.get(m.id);
          return {
            title: m.title,
            response: resp?.response_type || "unknown",
            comment: resp?.comment || null,
            respondedAt: resp?.created_at || null,
          };
        }),
        alerts: alerts.map((m: any) => ({
          title: m.title,
          body: m.body,
          priority: m.priority,
          asset: assetMap.get(m.asset_id) || null,
        })),
        updates: updates.map((m: any) => ({
          title: m.title,
          body: m.body,
        })),
      },
      budgets: budgetSummaries.length > 0 ? budgetSummaries.map((b) => ({
        asset: b.assetName,
        year: b.year,
        annualBudget: fmtVal(b.annualTotal),
      })) : null,
    };
  } catch (error) {
    console.error("Error fetching data snapshot:", error);
    return null;
  }
}

function buildSystemPrompt(data: any): string {
  return `You are the Fusion Cell AI assistant — a concierge intelligence system for a high-net-worth individual. You have complete visibility into their financial operations.

═══ PORTFOLIO OVERVIEW ═══
Total Value: ${data.portfolio.totalValue} across ${data.portfolio.assetCount} assets
By Category: ${data.portfolio.byCategory.join(" | ")}

Assets:
${data.portfolio.assets.map((a: any) => `• ${a.name} (${a.category}) — ${a.value}${a.description ? ` — ${a.description}` : ""}`).join("\n")}

═══ BILLING & CASH FLOW ═══
Due This Month: ${data.billing.dueThisMonth} (${data.billing.dueCount} bills)
Already Paid: ${data.billing.paidThisMonth}
${data.billing.overdueCount > 0 ? `⚠️ OVERDUE: ${data.billing.overdueCount} bills totaling ${data.billing.overdueTotal}\n${data.billing.overdueBills.map((b: any) => `  • ${b.title} — ${b.amount} (due ${b.dueDate}${b.asset ? `, ${b.asset}` : ""})`).join("\n")}` : "No overdue bills."}

By Category: ${data.billing.byCategory.map((c: any) => `${c.category}: ${c.total} (${c.count})`).join(" | ")}
${data.billing.byAsset.length > 0 ? `By Asset: ${data.billing.byAsset.map((a: any) => `${a.asset}: ${a.total} (${a.count})`).join(" | ")}` : ""}

Upcoming 30 Days:
${data.billing.upcoming30Days.map((b: any) => `• ${b.dueDate}: ${b.title} — ${b.amount}${b.payee ? ` to ${b.payee}` : ""}${b.asset ? ` (${b.asset})` : ""}`).join("\n")}

═══ MESSAGES & DECISIONS ═══
${data.messages.pendingDecisions.length > 0 ? `🔴 PENDING DECISIONS (${data.messages.pendingDecisions.length}):
${data.messages.pendingDecisions.map((m: any) => `• [${m.priority.toUpperCase()}] ${m.title}${m.asset ? ` (${m.asset})` : ""}\n  ${m.body || "No details"}\n  → Respond at [Messages](/messages)`).join("\n")}` : "No pending decisions."}

${data.messages.answeredDecisions.length > 0 ? `✅ Resolved Decisions:
${data.messages.answeredDecisions.map((m: any) => `• ${m.title} → ${m.response}${m.comment ? ` ("${m.comment}")` : ""}`).join("\n")}` : ""}

${data.messages.alerts.length > 0 ? `⚠️ Active Alerts:
${data.messages.alerts.map((m: any) => `• [${m.priority}] ${m.title}${m.asset ? ` (${m.asset})` : ""}: ${m.body || ""}`).join("\n")}` : ""}

${data.messages.updates.length > 0 ? `📋 Recent Updates:
${data.messages.updates.map((m: any) => `• ${m.title}: ${m.body || ""}`).join("\n")}` : ""}

${data.budgets ? `═══ BUDGETS ═══\n${data.budgets.map((b: any) => `• ${b.asset} (${b.year}): ${b.annualBudget} annual budget`).join("\n")}` : ""}

═══ NAVIGATION DEEP LINKS ═══
Include these as markdown links when relevant:
- Dashboard: [Dashboard](/)
- All Assets: [Assets](/assets)
${data.portfolio.assets.map((a: any) => `- ${a.name}: [View ${a.name}](/assets/${a.id})`).join("\n")}
- Fiscal Calendar: [Calendar](/calendar)
- Messages: [Messages](/messages)
- Settings: [Settings](/settings)

═══ YOUR ROLE ═══
1. Be concise and direct. This person is busy.
2. Prioritize: overdue items → pending decisions → upcoming large payments → general overview.
3. When mentioning assets, bills, or messages, always include a navigation link.
4. Use specific dollar amounts, dates, and names — never vague.
5. If asked "what needs my attention" or similar, lead with actionable items.
6. If asked about something not in the data, say so clearly.
7. Keep responses under 200 words unless detailed analysis is requested.
8. For financial analysis, do the math — show totals, comparisons, and trends.
9. When a decision is pending, summarize the context and what action is needed.`;
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
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const snapshot = await fetchComprehensiveSnapshot(supabaseUrl, supabaseKey);

    if (!snapshot) {
      return NextResponse.json({ error: "Failed to fetch data context" }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(snapshot);

    const claudeMessages = [
      ...(conversationHistory || []),
      ...messages,
    ].map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      return NextResponse.json({ error: "AI service temporarily unavailable" }, { status: 502 });
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || "I couldn't process that request.";

    return NextResponse.json({ message: assistantMessage, role: "assistant" });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "An error occurred processing your request" }, { status: 500 });
  }
}
