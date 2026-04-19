/**
 * Principal summary-card visibility service.
 *
 * Parallel to lib/module-visibility-service.ts but for the "quick glance"
 * cards that appear BELOW the orbital ring on /command for principals.
 * Stored in the `principal_summary_config` table (migration 030).
 *
 * Defaults are all-off — principals see nothing until admins explicitly
 * turn cards on from /admin/client/[orgId]/principal-experience.
 */

import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Card registry
// ============================================

export type SummaryCardKey =
  | "top_alerts"
  | "upcoming_travel"
  | "latest_brief"
  | "pending_decisions";

export interface SummaryCardMeta {
  key: SummaryCardKey;
  label: string;
  description: string;
  /** The module the card taps through to when clicked. Matches the
   *  orbital module keys so the existing openModule() flow just works. */
  opensModule: string;
}

export const SUMMARY_CARDS: SummaryCardMeta[] = [
  {
    key: "top_alerts",
    label: "Top Alerts",
    description: "Latest unresolved messages, priority-sorted.",
    opensModule: "comms",
  },
  {
    key: "upcoming_travel",
    label: "Upcoming Travel",
    description: "Next few legs across published itineraries.",
    opensModule: "travel",
  },
  {
    key: "latest_brief",
    label: "Latest Daily Brief",
    description: "Most recent published brief — title, date, short preview.",
    opensModule: "daily_brief",
  },
  {
    key: "pending_decisions",
    label: "Pending Decisions",
    description: "Decisions awaiting the principal's response.",
    opensModule: "comms",
  },
];

export const ALL_SUMMARY_KEYS: SummaryCardKey[] = SUMMARY_CARDS.map(
  (c) => c.key
);

// ============================================
// Config row shape
// ============================================

export interface SummaryConfigRow {
  card_key: SummaryCardKey;
  is_visible: boolean;
  position: number;
}

/**
 * Build the zero-state config: every card known to v1, all hidden, in
 * registry order. Used when a principal has no rows in the table yet.
 */
function buildDefaultConfig(): SummaryConfigRow[] {
  return SUMMARY_CARDS.map((c, i) => ({
    card_key: c.key,
    is_visible: false,
    position: i,
  }));
}

// ============================================
// Read
// ============================================

/**
 * Returns the merged card config for a principal, including every known
 * card_key even if the DB has no row for it (defaults to is_visible=false).
 * Always in canonical registry order so the admin UI lists cards
 * deterministically.
 */
export async function getSummaryConfigForPrincipal(
  orgId: string,
  principalId: string
): Promise<SummaryConfigRow[]> {
  const { data, error } = await db
    .from("principal_summary_config")
    .select("card_key, is_visible, position")
    .eq("organization_id", orgId)
    .eq("principal_id", principalId);

  if (error) {
    console.error("[getSummaryConfigForPrincipal]", error);
    return buildDefaultConfig();
  }

  const rows = (data ?? []) as SummaryConfigRow[];
  const byKey = new Map<SummaryCardKey, SummaryConfigRow>();
  for (const r of rows) byKey.set(r.card_key, r);

  return SUMMARY_CARDS.map((c, i) => {
    const existing = byKey.get(c.key);
    return (
      existing ?? {
        card_key: c.key,
        is_visible: false,
        position: i,
      }
    );
  });
}

/**
 * Returns JUST the card_keys the given principal should currently see.
 * Ordered by position. Empty array when nothing is turned on or the
 * principal has no rows yet (defaults-off).
 *
 * Staff/admin callers get an empty array too — this is specifically the
 * principal-facing view. Staff use /command differently.
 */
export async function getVisibleSummaryCardsForPrincipal(
  orgId: string,
  principalId: string
): Promise<SummaryCardKey[]> {
  const rows = await getSummaryConfigForPrincipal(orgId, principalId);
  return rows
    .filter((r) => r.is_visible)
    .sort((a, b) => a.position - b.position)
    .map((r) => r.card_key);
}

// ============================================
// Write
// ============================================

export async function setSummaryCardVisibility(
  orgId: string,
  principalId: string,
  cardKey: SummaryCardKey,
  isVisible: boolean
): Promise<{ success: boolean; error?: string }> {
  // Upsert so the row exists whether or not the admin has touched this
  // card before. Position defaults to the registry index when creating.
  const position = SUMMARY_CARDS.findIndex((c) => c.key === cardKey);
  const { error } = await db
    .from("principal_summary_config")
    .upsert(
      {
        organization_id: orgId,
        principal_id: principalId,
        card_key: cardKey,
        is_visible: isVisible,
        position: position >= 0 ? position : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,principal_id,card_key" }
    );
  if (error) {
    console.error("[setSummaryCardVisibility]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Reset: delete every config row for this principal. After this they'll
 * see all cards as hidden (defaults). Mirrors the Reset button pattern
 * in the Principal Experience admin page for modules.
 */
export async function resetSummaryConfigForPrincipal(
  orgId: string,
  principalId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("principal_summary_config")
    .delete()
    .eq("organization_id", orgId)
    .eq("principal_id", principalId);
  if (error) {
    console.error("[resetSummaryConfigForPrincipal]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
