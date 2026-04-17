import { NextRequest, NextResponse } from "next/server";
import {
  fetchDocumentIndex,
  formatDocumentContext,
  type DocumentSummary,
} from "@/lib/document-index";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Simple in-memory cache
const contextCache = new Map<string, { context: string; timestamp: number }>();
const CACHE_TTL = 60_000; // 60 seconds

async function assembleAccountContext(
  supabaseUrl: string,
  supabaseKey: string,
  organizationId: string
): Promise<string> {
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

  const [
    assets,
    budgets,
    budgetLineItems,
    expenseCategories,
    bills,
    messages,
    messageResponses,
    contacts,
  ] = await Promise.all([
    fetchTable(
      `assets?organization_id=eq.${organizationId}&is_deleted=eq.false` +
        `&select=id,name,category,estimated_value,identifier,description,status` +
        `&order=estimated_value.desc`
    ),
    fetchTable(
      `budgets?organization_id=eq.${organizationId}&select=id,asset_id,year`
    ),
    fetchTable(
      `budget_line_items?select=id,budget_id,expense_category_id,description,` +
        `jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec,annual_total`
    ),
    fetchTable("expense_categories?select=id,name"),
    fetchTable(
      `bills?organization_id=eq.${organizationId}` +
        `&select=id,asset_id,title,amount_cents,due_date,category,payee,status` +
        `&order=due_date.desc&limit=200`
    ),
    fetchTable(
      `messages?organization_id=eq.${organizationId}&is_deleted=eq.false` +
        `&select=id,asset_id,type,priority,title,body,due_date,created_at` +
        `&order=created_at.desc&limit=50`
    ),
    fetchTable(
      `message_responses?select=id,message_id,response_type,comment,created_at`
    ),
    fetchTable(
      `project_contacts?organization_id=eq.${organizationId}` +
        `&select=id,contact_type,name,role,company,company_name,trade,` +
        `contract_value_cents,status`
    ).catch(() => []),
  ]);

  // Build lookup maps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assetMap = new Map<string, any>(assets.map((a: any) => [a.id, a]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categoryMap = new Map<string, string>(expenseCategories.map((c: any) => [c.id, c.name]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseMap = new Map<string, any>(messageResponses.map((r: any) => [r.message_id, r]));

  // Filter budget line items to this org's budgets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgBudgetIds = new Set(budgets.map((b: any) => b.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgLineItems = budgetLineItems.filter((li: any) =>
    orgBudgetIds.has(li.budget_id)
  );

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);

  const fmtVal = (dollars: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(dollars);

  let context = "";

  // === ASSETS ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalValue = assets.reduce((s: number, a: any) => s + (a.estimated_value || 0), 0);
  context += `=== PROJECTS (${assets.length} total, combined value: ${fmtVal(totalValue)}) ===\n\n`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of assets as any[]) {
    context += `${a.name}\n`;
    context += `  ID: ${a.id}\n`;
    context += `  Category: ${a.category} | Value: ${fmtVal(a.estimated_value || 0)}\n`;
    if (a.description) context += `  Description: ${a.description}\n`;
    context += `  Status: ${a.status || "active"}\n\n`;
  }

  // === BUDGETS WITH LINE ITEMS ===
  context += `=== BUDGETS ===\n\n`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const budget of budgets as any[]) {
    const asset = assetMap.get(budget.asset_id);
    if (!asset) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = orgLineItems.filter((li: any) => li.budget_id === budget.id);
    if (items.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const budgetTotal = items.reduce((s: number, li: any) => s + (Number(li.annual_total) || 0), 0);
    context += `${asset.name} (${budget.year}) — Annual Total: ${fmtVal(budgetTotal)}\n`;

    // Group by expense category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byCat = new Map<string, any[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const li of items as any[]) {
      const catName = categoryMap.get(li.expense_category_id) || "Uncategorized";
      if (!byCat.has(catName)) byCat.set(catName, []);
      byCat.get(catName)!.push(li);
    }

    for (const [catName, catItems] of byCat) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catTotal = catItems.reduce((s: number, li: any) => s + (Number(li.annual_total) || 0), 0);
      context += `  ${catName}: ${fmtVal(catTotal)}/yr\n`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const li of catItems as any[]) {
        context += `    - ${li.description}: ${fmtVal(Number(li.annual_total) || 0)}/yr`;
        context += ` (Jan:${fmtVal(Number(li.jan) || 0)}`;
        context += ` Feb:${fmtVal(Number(li.feb) || 0)}`;
        context += ` Mar:${fmtVal(Number(li.mar) || 0)}`;
        context += ` Apr:${fmtVal(Number(li.apr) || 0)}`;
        context += ` May:${fmtVal(Number(li.may) || 0)}`;
        context += ` Jun:${fmtVal(Number(li.jun) || 0)}`;
        context += ` Jul:${fmtVal(Number(li.jul) || 0)}`;
        context += ` Aug:${fmtVal(Number(li.aug) || 0)}`;
        context += ` Sep:${fmtVal(Number(li.sep) || 0)}`;
        context += ` Oct:${fmtVal(Number(li.oct) || 0)}`;
        context += ` Nov:${fmtVal(Number(li.nov) || 0)}`;
        context += ` Dec:${fmtVal(Number(li.dec) || 0)})\n`;
      }
    }
    context += `\n`;
  }

  // === BILLS ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingBills = bills.filter((b: any) => b.status === "pending");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingTotal = pendingBills.reduce((s: number, b: any) => s + (b.amount_cents || 0), 0);
  context += `=== BILLS (${bills.length} total, ${pendingBills.length} pending: ${fmt(pendingTotal)}) ===\n\n`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const b of (bills as any[]).slice(0, 100)) {
    const asset = assetMap.get(b.asset_id);
    context += `${b.title}\n`;
    context += `  Asset: ${asset?.name || "General"} | Amount: ${fmt(b.amount_cents)} | Due: ${b.due_date} | Status: ${b.status}`;
    if (b.payee) context += ` | Payee: ${b.payee}`;
    if (b.category) context += ` | Category: ${b.category}`;
    context += `\n\n`;
  }

  // === MESSAGES ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingDecisions = messages.filter((m: any) => m.type === "decision" && !responseMap.has(m.id));
  context += `=== MESSAGES (${messages.length} total, ${pendingDecisions.length} decisions pending) ===\n\n`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of messages as any[]) {
    const asset = assetMap.get(m.asset_id);
    const resp = responseMap.get(m.id);
    context += `[${m.type.toUpperCase()} - ${m.priority}] ${m.title}\n`;
    if (asset) context += `  Asset: ${asset.name} (${asset.id})\n`;
    if (m.body) {
      const summary = m.body.length > 300 ? m.body.substring(0, 300) + "..." : m.body;
      context += `  Body: ${summary}\n`;
    }
    if (resp) {
      context += `  Response: ${resp.response_type}`;
      if (resp.comment) context += ` - "${resp.comment}"`;
      context += `\n`;
    } else if (m.type === "decision") {
      context += `  Status: AWAITING RESPONSE\n`;
    }
    context += `\n`;
  }

  // === CONTACTS ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (contacts && (contacts as any[]).length > 0) {
    context += `=== CONTACTS (${(contacts as any[]).length}) ===\n\n`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of contacts as any[]) {
      if (c.contact_type === "personnel") {
        context += `[PERSONNEL] ${c.name}`;
        if (c.role) context += ` - ${c.role}`;
        if (c.company) context += ` at ${c.company}`;
        context += ` | Status: ${c.status}\n`;
      } else {
        context += `[SUBCONTRACTOR] ${c.company_name || c.name}`;
        if (c.trade) context += ` (${c.trade})`;
        if (c.contract_value_cents) context += ` | Contract: ${fmt(c.contract_value_cents)}`;
        context += ` | Status: ${c.status}\n`;
      }
    }
    context += `\n`;
  }

  // === DOCUMENTS (Phase 9) ===
  try {
    const docs = await fetchDocumentIndex(fetchTable, organizationId);
    if (docs.length > 0) {
      context += formatDocumentContext(docs);
      // Tuck the document list onto the context string so the route handler
      // can read it back for audit logging without re-querying.
      (assembleAccountContext as unknown as {
        _lastDocs?: DocumentSummary[];
      })._lastDocs = docs;
    }
  } catch (err) {
    console.warn("[search] document index failed", err);
  }

  return context;
}

function buildSearchSystemPrompt(context: string): string {
  return `You are an advanced search system for a project management platform. You have complete access to the account data below. Answer the user's question using ONLY the data provided.

RULES:
1. Always calculate precise totals. Sum actual values from the data.
2. When referencing a project, include its ID for linking.
3. If the data does not contain what is needed, say so clearly.
4. Never guess, estimate, or extrapolate beyond the provided data.
5. Format currency as USD with commas ($1,234,567).
6. Be concise. Lead with the direct answer, then provide breakdown.
7. Never identify yourself as AI, an assistant, or a chatbot.
8. Phrase the "answer" field as the search system itself (e.g. "Found X across Y projects." or "Total value of all business projects is $X."). This framing belongs INSIDE the JSON answer field — do NOT add any prose before or after the JSON object.
9. For expense queries, search BOTH budget line items AND bills. Budget line items have expense category names and descriptions. Bills have title, category, and payee fields. Search all text fields for relevant keywords.
10. For time-based queries, use the monthly breakdown data (jan-dec) in budget line items to calculate quarterly or seasonal totals.
11. For document queries ("show me", "find", "pull up", "what documents do I have for X"), respond with a clean list of relevant docs from the DOCUMENTS section, each formatted as a tappable link:
   - [Document title](link) — brief context (one line)
   Do not summarize document contents unless explicitly asked — the principal opens the document themselves to read it. Include these as items in the "breakdown" array with the "label" as "[Title](link)" and a short "detail" line.

OUTPUT RULES:
- Your ENTIRE reply must be a single JSON object and nothing else.
- No prose, greetings, or explanation before the opening "{".
- No text, notes, or commentary after the closing "}".
- No markdown code fences.

RESPONSE FORMAT (MUST be valid JSON, no markdown fences):
{
  "answer": "Direct answer in 1-3 sentences.",
  "total": null or number (raw dollar amount, no cents),
  "breakdown": [
    {
      "label": "Line item or category name",
      "value": number or null (raw dollars),
      "assetId": "UUID or null",
      "assetName": "Project name or null",
      "detail": "Extra context about this item"
    }
  ],
  "sources": ["budgets", "bills", "messages", etc.],
  "followUp": "Suggested follow-up question or null"
}

Keep breakdown to 1-10 items. Each should reference the specific project when applicable. Sort by value descending when showing financial data.

ACCOUNT DATA:
${context}`;
}

async function logDocumentQuery(
  supabaseUrl: string,
  supabaseKey: string,
  organizationId: string,
  query: string,
  documentIds: string[]
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      organization_id: organizationId,
      action: "ai.document_query",
      metadata: {
        query_text: query,
        document_ids_returned: documentIds,
      },
    }),
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Search is not configured. Contact your Fusion Cell team." },
      { status: 500 }
    );
  }

  try {
    const { query, organizationId } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { success: false, error: "Search query is required." },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Organization context is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Check cache
    const cached = contextCache.get(organizationId);
    let context: string;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      context = cached.context;
    } else {
      context = await assembleAccountContext(supabaseUrl, supabaseKey, organizationId);
      contextCache.set(organizationId, { context, timestamp: Date.now() });
    }

    const systemPrompt = buildSearchSystemPrompt(context);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      if (response.status === 429) {
        return NextResponse.json(
          { success: false, error: "Too many searches. Please wait a moment." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Search temporarily unavailable." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    try {
      const cleaned = rawText
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      // Be tolerant of stray prose around the JSON (e.g. model prepends a
      // sentence before the object). Slice from the first "{" to the last
      // "}" so JSON.parse sees valid JSON regardless of wrapping text.
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      const jsonSlice =
        firstBrace >= 0 && lastBrace > firstBrace
          ? cleaned.slice(firstBrace, lastBrace + 1)
          : cleaned;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = JSON.parse(jsonSlice);

      if (result.total != null) {
        result.formattedTotal = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(result.total);
      }

      if (result.breakdown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.breakdown = result.breakdown.map((item: any) => ({
          ...item,
          formattedValue:
            item.value != null
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                }).format(item.value)
              : null,
        }));
      }

      // Audit log for document queries — fires when the response breakdown
      // references any documents from the indexed set.
      const docs = (assembleAccountContext as unknown as {
        _lastDocs?: DocumentSummary[];
      })._lastDocs;
      if (docs && result.breakdown && Array.isArray(result.breakdown)) {
        const referencedIds = docs
          .filter((d) =>
            result.breakdown.some((b: { label?: string }) =>
              b.label && b.label.includes(d.title)
            )
          )
          .map((d) => d.id);
        if (referencedIds.length > 0) {
          await logDocumentQuery(
            supabaseUrl,
            supabaseKey,
            organizationId,
            query,
            referencedIds
          ).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        result,
        durationMs: Date.now() - startTime,
      });
    } catch {
      // JSON parse failed even after tolerant slicing. Show only the prose
      // portion (up to the first "{") so the user doesn't see a raw JSON
      // dump on the screen.
      const firstBrace = rawText.indexOf("{");
      const answerOnly =
        firstBrace >= 0 ? rawText.slice(0, firstBrace).trim() : rawText.trim();
      return NextResponse.json({
        success: true,
        result: {
          answer: answerOnly || "Couldn't parse a clean answer — try rephrasing.",
          total: null,
          formattedTotal: null,
          breakdown: [],
          sources: [],
          followUp: null,
        },
        durationMs: Date.now() - startTime,
      });
    }
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json(
      { success: false, error: "Search encountered an error. Please try again." },
      { status: 500 }
    );
  }
}
