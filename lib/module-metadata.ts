import {
  LayoutDashboard,
  Newspaper,
  Bell,
  Plane,
  PieChart,
  Wallet,
  Landmark,
  Users,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules";

export interface ModuleMeta {
  key: ModuleKey;
  label: string;
  description: string;
  icon: LucideIcon;
  routePath: string;
  /**
   * Dashboard is always a full-route navigation away from nucleus (Phase 2 Step
   * 2.2 spec). Every other module opens inside the focused overlay (Phase 3).
   */
  opensInOverlay: boolean;
  /**
   * Brand accent for orbit line + hover glow. Dashboard uses mint to signal
   * it's the "full-chrome" exit; other modules follow the marketing palette.
   */
  accent: string;
  glow: string;
}

export const MODULE_METADATA: Record<ModuleKey, ModuleMeta> = {
  [MODULE_KEYS.DASHBOARD]: {
    key: MODULE_KEYS.DASHBOARD,
    label: "Dashboard",
    description: "The full view — projects, value, category breakdown.",
    icon: LayoutDashboard,
    routePath: "/dashboard",
    opensInOverlay: false,
    accent: "#4ADE80",
    glow: "rgba(74, 222, 128, 0.18)",
  },
  [MODULE_KEYS.DAILY_BRIEF]: {
    key: MODULE_KEYS.DAILY_BRIEF,
    label: "Daily Brief",
    description: "Today's overview from your team.",
    icon: Newspaper,
    routePath: "/brief",
    opensInOverlay: true,
    accent: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.18)",
  },
  [MODULE_KEYS.COMMS]: {
    key: MODULE_KEYS.COMMS,
    label: "Alerts",
    description: "Alerts, decisions, action items.",
    icon: Bell,
    routePath: "/messages",
    opensInOverlay: true,
    accent: "#ef4444",
    glow: "rgba(239, 68, 68, 0.18)",
  },
  [MODULE_KEYS.TRAVEL]: {
    key: MODULE_KEYS.TRAVEL,
    label: "Travel",
    description: "Trips, itineraries, documents.",
    icon: Plane,
    routePath: "/travel",
    opensInOverlay: true,
    accent: "#22d3ee",
    glow: "rgba(34, 211, 238, 0.18)",
  },
  [MODULE_KEYS.BUDGETS]: {
    key: MODULE_KEYS.BUDGETS,
    label: "Budgets",
    description: "Operating budgets by project.",
    icon: PieChart,
    routePath: "/budget-editor",
    opensInOverlay: true,
    accent: "#d946ef",
    glow: "rgba(217, 70, 239, 0.18)",
  },
  [MODULE_KEYS.CASH_FLOW]: {
    key: MODULE_KEYS.CASH_FLOW,
    label: "Cash Flow",
    description: "Obligations and invoices.",
    icon: Wallet,
    routePath: "/cash-flow",
    opensInOverlay: true,
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.18)",
  },
  [MODULE_KEYS.PROJECTS]: {
    key: MODULE_KEYS.PROJECTS,
    label: "Projects",
    description: "Holdings across aviation, marine, real estate, more.",
    icon: Landmark,
    routePath: "/assets",
    opensInOverlay: true,
    accent: "#eab308",
    glow: "rgba(234, 179, 8, 0.18)",
  },
  [MODULE_KEYS.CONTACTS]: {
    key: MODULE_KEYS.CONTACTS,
    label: "Contacts",
    description: "Global directory across every project.",
    icon: Users,
    routePath: "/contacts",
    opensInOverlay: true,
    accent: "#f97316",
    glow: "rgba(249, 115, 22, 0.18)",
  },
  [MODULE_KEYS.CALENDAR]: {
    key: MODULE_KEYS.CALENDAR,
    label: "Calendar",
    description: "Unified view: shared calendars, bills, decisions, travel.",
    icon: Calendar,
    routePath: "/calendar",
    opensInOverlay: true,
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.18)",
  },
};

export function getModuleMeta(key: string): ModuleMeta | null {
  return (MODULE_METADATA as Record<string, ModuleMeta>)[key] ?? null;
}
