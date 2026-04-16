// ============================================
// Module registry
// Keys must match principal_module_config.module_key values.
// ============================================

export const MODULE_KEYS = {
  DASHBOARD: "dashboard",
  DAILY_BRIEF: "daily_brief",
  COMMS: "comms",
  TRAVEL: "travel",
  BUDGETS: "budgets",
  CASH_FLOW: "cash_flow",
  PROJECTS: "projects",
  CONTACTS: "contacts",
  CALENDAR: "calendar",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

/**
 * Ordered list of every module. Used as the canonical position order when no
 * drag-to-reorder has been applied (v1 defers reorder — see Phase 5 Step 5.4).
 */
export const ALL_MODULE_KEYS: ModuleKey[] = [
  MODULE_KEYS.DASHBOARD,
  MODULE_KEYS.DAILY_BRIEF,
  MODULE_KEYS.COMMS,
  MODULE_KEYS.TRAVEL,
  MODULE_KEYS.BUDGETS,
  MODULE_KEYS.CASH_FLOW,
  MODULE_KEYS.PROJECTS,
  MODULE_KEYS.CONTACTS,
  MODULE_KEYS.CALENDAR,
];

/**
 * Modules enabled by default on a newly-seeded principal.
 * Everything else is hidden until the admin opts it in from the
 * Principal Experience page (Phase 5).
 */
export const DEFAULT_PRINCIPAL_MODULES: ModuleKey[] = [
  MODULE_KEYS.DASHBOARD,
  MODULE_KEYS.DAILY_BRIEF,
  MODULE_KEYS.COMMS,
];

/**
 * Modules that cannot be toggled off regardless of admin preference.
 * Dashboard is the principal's full view; Comms is required for
 * decision-approval workflows.
 */
export const REQUIRED_MODULE_KEYS: ModuleKey[] = [
  MODULE_KEYS.DASHBOARD,
  MODULE_KEYS.COMMS,
];

export function isRequiredModule(key: string): boolean {
  return REQUIRED_MODULE_KEYS.includes(key as ModuleKey);
}

export function isDefaultModule(key: string): boolean {
  return DEFAULT_PRINCIPAL_MODULES.includes(key as ModuleKey);
}
