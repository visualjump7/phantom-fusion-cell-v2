"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Building2,
  DollarSign,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { useRole } from "@/lib/use-role";

interface BottomNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Delegates only see items flagged visible for them. */
  delegateVisible?: boolean;
  /** Label override when rendered for a delegate. */
  delegateName?: string;
}

// Mirrors the admin/executive-facing nav in lib/nav-items.ts (trimmed to 5 for
// the tab bar). Kept inline because the bottom bar uses smaller icon sizes and
// a different label convention.
const bottomNavItems: BottomNavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Map", href: "/globe", icon: Globe },
  {
    name: "Directory",
    href: "/assets",
    icon: Building2,
    delegateVisible: true,
    delegateName: "Projects",
  },
  { name: "Cash Flow", href: "/cash-flow", icon: DollarSign },
  { name: "Alerts", href: "/messages", icon: MessageSquare, delegateVisible: true },
];

// Routes that manage their own bottom UI (fullscreen immersive views).
// The bottom nav is suppressed on these paths to avoid overlap.
// "/" is the orbital landing, "/command" is the command panel — both meant
// to stand alone.
const SUPPRESS_ON: string[] = ["/globe", "/", "/command"];

export function BottomNavBar() {
  const pathname = usePathname();
  const { isDelegate } = useRole();

  if (SUPPRESS_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const visibleItems = isDelegate
    ? bottomNavItems.filter((i) => i.delegateVisible)
    : bottomNavItems;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
      style={{
        // --bn-h drops to 44px in landscape-short viewports (see globals.css).
        height: "calc(var(--bn-h, 60px) + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        backgroundColor: "#0a0a0a",
        borderTop: "1px solid #222222",
      }}
    >
      <ul className="flex w-full items-stretch justify-around">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const color = isActive ? "#4ade80" : "#71717a";
          const label = isDelegate && item.delegateName ? item.delegateName : item.name;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="flex h-full min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1"
                style={{ color }}
              >
                <Icon size={20} className="shrink-0" />
                <span
                  className="leading-none"
                  style={{ fontSize: "10px", fontWeight: 500 }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
