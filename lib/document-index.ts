/**
 * Document index — merges documents from project blocks (currently project
 * images with captions) and travel documents into a single searchable
 * shape. Documents with ai_accessible=false are filtered OUT.
 *
 * The search route calls fetchDocumentIndex(orgId) on each request and
 * inlines a formatted section into the system prompt (see Phase 9 Step 9.2).
 */

export interface DocumentSummary {
  id: string;
  title: string;
  document_type: string | null;
  source: "project" | "travel";
  asset_id: string | null;
  asset_name: string | null;
  itinerary_id: string | null;
  itinerary_title: string | null;
  uploaded_at: string;
  href: string;
  ai_accessible: boolean;
}

type FetchFn = (query: string) => Promise<any[]>;

/**
 * Accept-a-fetch-fn variant so both the browser and server can reuse it.
 * In the Next.js API route we construct a REST fetcher against Supabase.
 */
export async function fetchDocumentIndex(
  fetchTable: FetchFn,
  organizationId: string
): Promise<DocumentSummary[]> {
  const [projectDocs, travelDocs, assets, itineraries] = await Promise.all([
    fetchProjectDocuments(fetchTable, organizationId),
    fetchTravelDocuments(fetchTable, organizationId),
    fetchTable(
      `assets?organization_id=eq.${organizationId}&is_deleted=eq.false&select=id,name`
    ).catch(() => [] as { id: string; name: string }[]),
    fetchTable(
      `travel_itineraries?organization_id=eq.${organizationId}&select=id,title`
    ).catch(() => [] as { id: string; title: string }[]),
  ]);

  const assetNameById = new Map<string, string>(
    assets.map((a) => [a.id, a.name])
  );
  const itinTitleById = new Map<string, string>(
    itineraries.map((t: { id: string; title: string }) => [t.id, t.title])
  );

  const merged: DocumentSummary[] = [];

  for (const d of projectDocs) {
    merged.push({
      ...d,
      asset_name: d.asset_id ? assetNameById.get(d.asset_id) ?? null : null,
    });
  }

  for (const d of travelDocs) {
    merged.push({
      ...d,
      itinerary_title: d.itinerary_id
        ? itinTitleById.get(d.itinerary_id) ?? null
        : null,
    });
  }

  return merged.filter((d) => d.ai_accessible);
}

async function fetchProjectDocuments(
  fetchTable: FetchFn,
  organizationId: string
): Promise<DocumentSummary[]> {
  // project_documents table (optional — some installs may not have it).
  // Fall back silently if the table doesn't exist.
  try {
    const rows = await fetchTable(
      `project_documents?organization_id=eq.${organizationId}` +
        `&select=id,asset_id,title,document_type,ai_accessible,created_at`
    );
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title || "Document",
      document_type: r.document_type ?? null,
      source: "project" as const,
      asset_id: r.asset_id ?? null,
      asset_name: null,
      itinerary_id: null,
      itinerary_title: null,
      uploaded_at: r.created_at,
      href: r.asset_id
        ? `/assets/${r.asset_id}`
        : `/assets`,
      ai_accessible: r.ai_accessible !== false,
    }));
  } catch {
    return [];
  }
}

async function fetchTravelDocuments(
  fetchTable: FetchFn,
  organizationId: string
): Promise<DocumentSummary[]> {
  try {
    const rows = await fetchTable(
      `travel_documents?organization_id=eq.${organizationId}` +
        `&select=id,itinerary_id,title,document_type,ai_accessible,created_at`
    );
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title || "Travel document",
      document_type: r.document_type ?? null,
      source: "travel" as const,
      asset_id: null,
      asset_name: null,
      itinerary_id: r.itinerary_id,
      itinerary_title: null,
      uploaded_at: r.created_at,
      href: `/travel/${r.itinerary_id}`,
      ai_accessible: r.ai_accessible !== false,
    }));
  } catch {
    return [];
  }
}

/**
 * Format the document index as a text block for the Advanced Search
 * system prompt. Caps detail at ~50 documents; above that we emit a
 * summary of counts per asset / itinerary and let the model ask for
 * specifics.
 */
export function formatDocumentContext(docs: DocumentSummary[]): string {
  const project = docs.filter((d) => d.source === "project");
  const travel = docs.filter((d) => d.source === "travel");

  let out = `=== DOCUMENTS (${docs.length} total across ${new Set(project.map((d) => d.asset_id)).size} projects + ${new Set(travel.map((d) => d.itinerary_id)).size} trips) ===\n\n`;

  if (docs.length > 50) {
    out += `(Index truncated to summary — ${docs.length} documents exceeds inline limit. Ask by asset or trip for specifics.)\n\n`;
    const byAsset = groupCount(project, (d) => d.asset_name || "Unknown project");
    const byItin = groupCount(travel, (d) => d.itinerary_title || "Unknown trip");
    out += `PROJECT DOCUMENT COUNTS:\n`;
    for (const [k, c] of byAsset) out += `- ${k}: ${c}\n`;
    out += `\nTRAVEL DOCUMENT COUNTS:\n`;
    for (const [k, c] of byItin) out += `- ${k}: ${c}\n`;
    return out + "\n";
  }

  if (project.length > 0) {
    out += `PROJECT DOCUMENTS:\n`;
    project.forEach((d, i) => {
      out +=
        `${i + 1}. ${d.title}` +
        (d.document_type ? ` (${d.document_type})` : "") +
        `\n` +
        (d.asset_name ? `   Asset: ${d.asset_name} | ` : "   ") +
        `Uploaded: ${short(d.uploaded_at)}\n` +
        `   Link: ${d.href}\n\n`;
    });
  }

  if (travel.length > 0) {
    out += `TRAVEL DOCUMENTS:\n`;
    travel.forEach((d, i) => {
      out +=
        `${i + 1}. ${d.title}` +
        (d.document_type ? ` (${d.document_type})` : "") +
        `\n` +
        (d.itinerary_title ? `   Itinerary: ${d.itinerary_title} | ` : "   ") +
        `Uploaded: ${short(d.uploaded_at)}\n` +
        `   Link: ${d.href}\n\n`;
    });
  }

  return out;
}

function short(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function groupCount<T>(items: T[], key: (t: T) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}
