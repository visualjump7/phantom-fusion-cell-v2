import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type DefaultLanding = "dashboard" | "nucleus";

/**
 * Returns the per-admin landing preference. Defaults to "dashboard" when no
 * row or no value is stored.
 */
export async function getDefaultLanding(userId: string): Promise<DefaultLanding> {
  const { data, error } = await db
    .from("profiles")
    .select("default_landing")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[getDefaultLanding]", error);
    return "dashboard";
  }

  const value = data.default_landing as DefaultLanding | null;
  return value === "nucleus" ? "nucleus" : "dashboard";
}

/**
 * Persists the admin's landing preference. Enforced at the DB layer by the
 * CHECK (default_landing IN ('dashboard','nucleus')) constraint.
 */
export async function setDefaultLanding(
  userId: string,
  value: DefaultLanding
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("profiles")
    .update({ default_landing: value })
    .eq("id", userId);

  if (error) {
    console.error("[setDefaultLanding]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============================================
// Welcome-overlay flag (Phase 11)
// ============================================

export async function hasSeenWelcome(userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("profiles")
    .select("has_seen_welcome")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[hasSeenWelcome]", error);
    return false;
  }
  return Boolean(data.has_seen_welcome);
}

export async function markWelcomeSeen(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("profiles")
    .update({ has_seen_welcome: true })
    .eq("id", userId);

  if (error) {
    console.error("[markWelcomeSeen]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
