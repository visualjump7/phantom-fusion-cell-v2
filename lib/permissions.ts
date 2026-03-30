export const PERMISSIONS = {
  // Principals
  addPrincipal: ["admin"],
  deletePrincipal: ["admin"],
  viewCommandCenter: ["admin", "manager", "viewer"],

  // Holdings
  viewHoldings: ["admin", "manager", "viewer", "executive"],
  viewAssignedProjects: ["executive", "delegate"],
  viewAllProjects: ["admin", "manager", "viewer", "executive"],
  manageHoldings: ["admin", "manager"],

  // Budgets & Bills
  viewBudgets: ["admin", "manager", "viewer", "executive", "delegate"],
  uploadBudgets: ["admin", "manager"],
  manageBills: ["admin", "manager"],

  // Messages
  viewMessages: ["admin", "manager", "viewer", "executive", "delegate"],
  composeMessages: ["admin", "manager"],
  sendSimpleMessage: ["executive"],
  approveDecisions: ["executive"],

  // Navigation / Views
  viewCashFlow: ["admin", "manager", "viewer", "executive"],
  viewDailyBrief: ["admin", "manager", "viewer", "executive"],
  viewDashboard: ["admin", "manager", "viewer", "executive"],

  // Users
  viewTeam: ["admin", "manager", "viewer"],
  manageUsers: ["admin"],
  manageDelegates: ["admin"],
  assignRoles: ["admin"],
  resetPasswords: ["admin"],

  // Settings
  manageSettings: ["admin"],
} as const;

export function hasPermission(
  role: string | null,
  permission: keyof typeof PERMISSIONS
): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
