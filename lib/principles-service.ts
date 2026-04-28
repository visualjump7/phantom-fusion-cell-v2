/**
 * Principles service.
 *
 * Org-scoped list of standing principles (title + description). Stored in
 * the `principles` table (migration 034). The Fusion Cell team manages
 * these from /admin/client/[orgId]/principles; executives read them.
 *
 * v1 is a flat list. The DB has a `position` column so we can layer on
 * drag-reorder later without a migration; for now new rows append.
 */

import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Principle {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Read
// ============================================

export async function fetchPrinciples(orgId: string): Promise<Principle[]> {
  const { data, error } = await db
    .from("principles")
    .select("*")
    .eq("organization_id", orgId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[fetchPrinciples]", error);
    return [];
  }
  return (data ?? []) as Principle[];
}

// ============================================
// Write
// ============================================

export async function createPrinciple(
  orgId: string,
  input: { title: string; description?: string }
): Promise<
  | { success: true; principle: Principle }
  | { success: false; error: string }
> {
  const title = input.title.trim();
  if (!title) return { success: false, error: "Title is required." };

  // New rows append. Read max(position) once — race risk is negligible in a
  // single-team admin context, and there's no unique constraint on position
  // to fight over. If two adds collide, the second just sorts after the
  // first by created_at (the secondary order in fetchPrinciples).
  const { data: maxRow } = await db
    .from("principles")
    .select("position")
    .eq("organization_id", orgId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { data, error } = await db
    .from("principles")
    .insert({
      organization_id: orgId,
      title,
      description: (input.description ?? "").trim(),
      position: nextPosition,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[createPrinciple]", error);
    return { success: false, error: error.message };
  }
  return { success: true, principle: data as Principle };
}

export async function updatePrinciple(
  id: string,
  patch: { title?: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { success: false, error: "Title can't be empty." };
    update.title = t;
  }
  if (patch.description !== undefined) {
    update.description = patch.description.trim();
  }
  const { error } = await db.from("principles").update(update).eq("id", id);
  if (error) {
    console.error("[updatePrinciple]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deletePrinciple(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("principles").delete().eq("id", id);
  if (error) {
    console.error("[deletePrinciple]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
