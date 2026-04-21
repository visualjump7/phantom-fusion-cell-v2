/**
 * Canonical navigation list. Used by every nav surface — <Navbar /> +
 * <MobileNavDrawer /> and <BottomNavBar /> — so that filtering rules
 * (delegate/executive visibility) and labels stay in sync.
 */

import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  DollarSign,
  FileText,
  Globe,
  ShieldCheck,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  executiveOnly?: boolean;
  delegateVisible?: boolean;
  delegateName?: string;
}

export const mainNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Map", href: "/globe", icon: Globe },
  { name: "Daily Brief", href: "/brief", icon: FileText, executiveOnly: true },
  {
    name: "Directory",
    href: "/assets",
    icon: Building2,
    delegateVisible: true,
    delegateName: "My Projects",
  },
  { name: "Cash Flow", href: "/cash-flow", icon: DollarSign },
  { name: "Alerts", href: "/messages", icon: MessageSquare, delegateVisible: true },
];

export const adminNavItems: NavItem[] = [
  { name: "Admin", href: "/admin", icon: ShieldCheck },
  { name: "Budget Editor", href: "/budget-editor", icon: FileSpreadsheet },
];
