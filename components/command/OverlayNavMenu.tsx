"use client";

/**
 * OverlayNavMenu — hamburger dropdown rendered inside the FocusedOverlay
 * header.
 *
 * When a principal/staff user is deep in a module overlay (Projects, Alerts,
 * Calendar, etc.), the main chrome-level navbar is hidden by the overlay.
 * This menu restores cross-site navigation without forcing the user to
 * close the overlay first: click the hamburger, pick a destination, land
 * there directly.
 *
 * Route list mirrors the filtering logic in components/Navbar.tsx so the
 * same role rules apply (delegates see a narrow subset, executives get the
 * Daily Brief entry, staff also see the Admin + Budget Editor
 * admin entries).
 *
 * Navigation side effects: closes the active Command overlay (via
 * useCommand().close) before pushing the new route, so the overlay is
 * never stranded on top of a fresh page. Sign-out clears the role cache
 * and pushes to /login, matching Navbar.tsx.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Building2,
  MessageSquare,
  Settings,
  LogOut,
  ShieldCheck,
  DollarSign,
  FileText,
  Globe,
  FileSpreadsheet,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRole, clearRoleCache } from "@/lib/use-role";
import { useCommand } from "./CommandContext";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  executiveOnly?: boolean;
  delegateVisible?: boolean;
  delegateName?: string;
}

const mainNavItems: NavItem[] = [
  { name: "Command", href: "/command", icon: CircleDot },
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
  {
    name: "Alerts",
    href: "/messages",
    icon: MessageSquare,
    delegateVisible: true,
  },
];

const adminNavItems: NavItem[] = [
  { name: "Admin", href: "/admin", icon: ShieldCheck },
  { name: "Budget Editor", href: "/budget-editor", icon: FileSpreadsheet },
];

export function OverlayNavMenu({
  align = "left",
}: {
  /** Side of the trigger the dropdown panel opens toward. Default "left"
   *  opens the panel downward-right (anchored at left:0); "right" opens it
   *  downward-left (anchored at right:0), which is what we want when the
   *  hamburger is placed on the right edge of the overlay header. */
  align?: "left" | "right";
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { close: closeOverlay } = useCommand();
  const { isStaff, isExecutive, isDelegate } = useRole();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Outside-click and Escape close the dropdown (but don't close the overlay).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const visibleMain = mainNavItems.filter((item) => {
    if (isDelegate) return item.delegateVisible;
    if (item.executiveOnly) return isExecutive;
    return true;
  });

  function go(href: string) {
    setOpen(false);
    closeOverlay();
    if (href !== pathname) {
      router.push(href);
    }
  }

  async function handleSignOut() {
    setOpen(false);
    closeOverlay();
    clearRoleCache();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-[60] mt-2 w-64 rounded-xl border border-white/10 bg-neutral-900/95 py-1 shadow-2xl backdrop-blur-md",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {visibleMain.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const label =
              isDelegate && item.delegateName ? item.delegateName : item.name;
            return (
              <button
                key={item.href}
                role="menuitem"
                onClick={() => go(item.href)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-400/10 text-emerald-200"
                    : "text-white/85 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}

          {isStaff && (
            <>
              <div className="my-1 border-t border-white/10" />
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Admin
              </div>
              {adminNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    role="menuitem"
                    onClick={() => go(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition-colors",
                      isActive
                        ? "bg-emerald-400/10 text-emerald-200"
                        : "text-white/85 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </button>
                );
              })}
            </>
          )}

          <div className="my-1 border-t border-white/10" />
          <button
            role="menuitem"
            onClick={() => go("/settings")}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-white/85 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </button>
          <button
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-red-400 transition-colors hover:bg-white/5"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default OverlayNavMenu;
