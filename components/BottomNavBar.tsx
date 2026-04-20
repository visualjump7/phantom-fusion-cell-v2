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

interface BottomNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// Reuses the same routes/icons as the main Navbar
const bottomNavItems: BottomNavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Map", href: "/globe", icon: Globe },
  { name: "Directory", href: "/assets", icon: Building2 },
  { name: "Cash Flow", href: "/cash-flow", icon: DollarSign },
  { name: "Alerts", href: "/messages", icon: MessageSquare },
];

// Routes that manage their own bottom UI (fullscreen immersive views).
// The bottom nav is suppressed on these paths to avoid overlap.
// "/" is the orbital landing — its design is meant to stand alone.
const SUPPRESS_ON: string[] = ["/globe", "/"];

export function BottomNavBar() {
  const pathname = usePathname();

  if (SUPPRESS_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

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
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const color = isActive ? "#4ade80" : "#71717a";
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
                  {item.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
