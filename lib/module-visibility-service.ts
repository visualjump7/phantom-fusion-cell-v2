import { supabase } from "@/lib/supabase";
import {
  ALL_MODULE_KEYS,
  DEFAULT_PRINCIPAL_MODULES,
  MODULE_KEYS,
  ModuleKey,
} from "@/lib/modules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export interface ModuleConfigRow {
  module_key: ModuleKey;
  is_visible: boolean;
  position: number;
}

// ============================================
// Read helpers
// ============================================

/**
 * Returns the merged module config for a principal.
 * If no rows exist yet, returns DEFAULT_PRINCIPAL_MODULES marked visible
 * and every other key marked hidden. Always includes all nine keys
 * in canonical (ALL_MODULE_KEYS) order.
 */
export async function getModuleConfigForPrincipal(
  orgId: string,
  principalId: string
): Promise<ModuleConfigRow[]> {
  const { data, error } = await db
    .from("principal_module_config")
    .select("module_key, is_visible, position")
    .eq("organization_id", orgId)
    .eq("principal_id", principalId);

  if (error) {
    console.error("[getModuleConfigForPrincipal]", error);
    return buildDefaultConfig();
  }

  const rows = (data || []) as ModuleConfigRow[];

  if (rows.length === 0) {
    return buildDefaultConfig();
  }

  const byKey = new Map<string, ModuleConfigRow>(
    rows.map((r) => [r.module_key, r])
  );

  return ALL_MODULE_KEYS.map((key, idx) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    return {
      module_key: key,
      is_visible: DEFAULT_PRINCIPAL_MODULES.includes(key),
      position: idx,
    };
  });
}

function buildDefaultConfig(): ModuleConfigRow[] {
  return ALL_MODULE_KEYS.map((key, idx) => ({
    module_key: key,
    is_visible: DEFAULT_PRINCIPAL_MODULES.includes(key),
    position: idx,
  }));
}

/**
 * Returns the list of module keys a given user should see in their nucleus.
 * - Principals (executive/delegate): only keys with is_visible=true.
 * - Admins/managers/owners: every module key (admins always see the full set).
 */
export async function getVisibleModulesForUser(
  orgId: string,
  userId: string,
  role: string | null
): Promise<ModuleKey[]> {
  const normalizedRole = (role ?? "").toLowerCase();
  const isAdminSide = ["admin", "owner", "manager"].includes(normalizedRole);

  if (isAdminSide) {
    return [...ALL_MODULE_KEYS];
  }

  const config = await getModuleConfigForPrincipal(orgId, userId);
  return config
    .filter((r) => r.is_visible)
    .sort((a, b) => a.position - b.position)
    .map((r) => r.module_key);
}

// ============================================
// Write helpers
// ============================================

/**
 * Upserts a single module-visibility flag for a principal.
 */
export async function setModuleVisibility(
  orgId: string,
  principalId: string,
  moduleKey: ModuleKey,
  isVisible: boolean
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const position = ALL_MODULE_KEYS.indexOf(moduleKey);

  const { error } = await db
    .from("principal_module_config")
    .upsert(
      {
        organization_id: orgId,
        principal_id: principalId,
        module_key: moduleKey,
        is_visible: isVisible,
        position: position === -1 ? 0 : position,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,principal_id,module_key" }
    );

  if (error) {
    console.error("[setModuleVisibility]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Seeds a newly-created principal with the default module set.
 * DEFAULT_PRINCIPAL_MODULES → is_visible=true.
 * All other keys → is_visible=false.
 * Safe to re-run: uses upsert on the unique constraint.
 */
export async function seedDefaultsForPrincipal(
  orgId: string,
  principalId: string
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = ALL_MODULE_KEYS.map((key, idx) => ({
    organization_id: orgId,
    principal_id: principalId,
    module_key: key,
    is_visible: DEFAULT_PRINCIPAL_MODULES.includes(key),
    position: idx,
    updated_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db
    .from("principal_module_config")
    .upsert(rows, { onConflict: "organization_id,principal_id,module_key" });

  if (error) {
    console.error("[seedDefaultsForPrincipal]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Clears all config rows for a principal so the next read falls back to defaults.
 * Used by the "Reset to defaults" button (Phase 5 Step 5.2) followed by seeding.
 */
export async function resetPrincipalToDefaults(
  orgId: string,
  principalId: string
): Promise<{ success: boolean; error?: string }> {
  const { error: deleteError } = await db
    .from("principal_module_config")
    .delete()
    .eq("organization_id", orgId)
    .eq("principal_id", principalId);

  if (deleteError) {
    console.error("[resetPrincipalToDefaults] delete", deleteError);
    return { success: false, error: deleteError.message };
  }

  return seedDefaultsForPrincipal(orgId, principalId);
}

// Re-export for convenience so callers can `import { MODULE_KEYS } from
// '@/lib/module-visibility-service'` without a second import.
export { MODULE_KEYS, ALL_MODULE_KEYS, DEFAULT_PRINCIPAL_MODULES };
export type { ModuleKey };
