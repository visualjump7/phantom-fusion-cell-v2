/**
 * Command-page layout service.
 *
 * Per-(org, executive) choice between the orbital nucleus layout (default)
 * and the briefing layout (greeting + section list). Mirrors the
 * principal_module_config / principal_summary_config pattern: the team
 * controls it from /admin/client/[orgId]/principal-experience; executives
 * read their own row at /command render time.
 *
 * Defaults to "orbital" so an executive with no row gets the layout the app
 * has shipped with all along.
 */

import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type CommandLayout = "orbital" | "briefing";

export const DEFAULT_COMMAND_LAYOUT: CommandLayout = "orbital";

// ============================================
// Read
// ============================================

export async function getCommandLayout(
  orgId: string,
  principalId: string
): Promise<CommandLayout> {
  if (!orgId || !principalId) return DEFAULT_COMMAND_LAYOUT;
  const { data, error } = await db
    .from("principal_layout_config")
    .select("layout")
    .eq("organization_id", orgId)
    .eq("principal_id", principalId)
    .maybeSingle();
  if (error) {
    console.error("[getCommandLayout]", error);
    return DEFAULT_COMMAND_LAYOUT;
  }
  const value = (data as { layout?: string } | null)?.layout;
  if (value === "orbital" || value === "briefing") return value;
  return DEFAULT_COMMAND_LAYOUT;
}

// ============================================
// Write
// ============================================

export async function setCommandLayout(
  orgId: string,
  principalId: string,
  layout: CommandLayout
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await db.from("principal_layout_config").upsert(
    {
      organization_id: orgId,
      principal_id: principalId,
      layout,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,principal_id" }
  );
  if (error) {
    console.error("[setCommandLayout]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============================================
// Per-USER layout (profiles.command_layout — migration 036)
//
// Used for staff (admin / manager) who don't have a principal-controlled row
// in principal_layout_config. Executives still take their layout from the
// per-(org, executive) table; this is the staff-facing fallback they pick
// for themselves from /settings → Appearance.
// ============================================

export async function getUserCommandLayout(
  userId: string
): Promise<CommandLayout> {
  if (!userId) return DEFAULT_COMMAND_LAYOUT;
  const { data, error } = await db
    .from("profiles")
    .select("command_layout")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[getUserCommandLayout]", error);
    return DEFAULT_COMMAND_LAYOUT;
  }
  const value = (data as { command_layout?: string } | null)?.command_layout;
  if (value === "orbital" || value === "briefing") return value;
  return DEFAULT_COMMAND_LAYOUT;
}

export async function setUserCommandLayout(
  userId: string,
  layout: CommandLayout
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("profiles")
    .update({ command_layout: layout })
    .eq("id", userId);
  if (error) {
    console.error("[setUserCommandLayout]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
