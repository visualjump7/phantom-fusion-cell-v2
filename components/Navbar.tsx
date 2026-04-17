"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  TrendingUp,
  Receipt,
  SendHorizontal,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  DollarSign,
  FileText,
  Globe,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRole, clearRoleCache } from "@/lib/use-role";
import { useThemePreferences } from "@/components/ThemeProvider";
import { GlobalClientBanner } from "@/components/admin/shared/GlobalClientBanner";
import { SearchBar, SearchTrigger } from "@/components/search/SearchBar";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import {
  AdminSettingsMenu,
  AdminOverlayHost,
} from "@/components/admin/AdminSettingsMenu";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  executiveOnly?: boolean;
  delegateVisible?: boolean;
  delegateName?: string;
}

const mainNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Map", href: "/globe", icon: Globe },
  { name: "Daily Brief", href: "/brief", icon: FileText, executiveOnly: true },
  { name: "Directory", href: "/assets", icon: Building2, delegateVisible: true, delegateName: "My Projects" },
  { name: "Cash Flow", href: "/cash-flow", icon: DollarSign },
  { name: "Alerts", href: "/messages", icon: MessageSquare, delegateVisible: true },
];

const adminNavItems: NavItem[] = [
  { name: "Command Center", href: "/admin", icon: ShieldCheck },
  { name: "Budget Editor", href: "/budget-editor", icon: FileSpreadsheet },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const { isAdmin, isStaff, isExecutive, isDelegate, role } = useRole();
  const { density } = useThemePreferences();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const [searchOpen, setSearchOpen] = useState(false);
  const [nucleusOverlayOpen, setNucleusOverlayOpen] = useState(false);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


  useEffect(() => {
    if (!settingsDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setSettingsDropdownOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [settingsDropdownOpen]);

  const handleSignOut = async () => {
    clearRoleCache();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
    <nav className="sticky top-0 z-50 hidden border-b border-border bg-background/95 backdrop-blur-md text-foreground md:block">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">Fusion <span className="text-primary">Cell</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {mainNavItems.filter(item => {
              if (isDelegate) return item.delegateVisible;
              if (item.executiveOnly) return isExecutive;
              return true;
            }).map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-[var(--tap-target-min)] items-center gap-2 rounded-lg px-3 py-2 text-[length:var(--font-size-body)] font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="nav-label">{isDelegate && item.delegateName ? item.delegateName : item.name}</span>
                </Link>
              );
            })}
            {isDelegate && (
              <span className="ml-1 rounded-md bg-amber-600/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                Delegate
              </span>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {effectiveOrgId && !isDelegate && (
              <div className="hidden md:block">
                <SearchTrigger onClick={() => setSearchOpen(true)} />
              </div>
            )}
            <div className="relative hidden md:block" ref={settingsDropdownRef}>
              <button
                type="button"
                onClick={() => setSettingsDropdownOpen((v) => !v)}
                className="flex min-h-[var(--tap-target-min)] items-center gap-2 rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Settings className="h-5 w-5" />
                {density === "comfort" && <span className="text-[length:var(--font-size-body)] font-medium">Settings</span>}
              </button>
              {settingsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-1 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-lg"
                >
                  <AdminSettingsMenu
                    onOpenNucleus={() => setNucleusOverlayOpen(true)}
                    onRequestClose={() => setSettingsDropdownOpen(false)}
                  />
                  <Link
                    href="/settings"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex min-h-[var(--tap-target-min)] items-center gap-2 px-3 py-2 text-[length:var(--font-size-body)] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    All Settings
                  </Link>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => { setSettingsDropdownOpen(false); handleSignOut(); }}
                    className="flex min-h-[var(--tap-target-min)] w-full items-center gap-2 px-3 py-2 text-[length:var(--font-size-body)] font-medium text-red-400 hover:bg-muted transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-border bg-background px-4 py-4 md:hidden"
        >
          <div className="space-y-1">
            {mainNavItems.filter(item => {
              if (isDelegate) return item.delegateVisible;
              if (item.executiveOnly) return isExecutive;
              return true;
            }).map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-[var(--tap-target-min)] items-center gap-3 rounded-lg px-3 py-2.5 text-[length:var(--font-size-body)] font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="nav-label">{isDelegate && item.delegateName ? item.delegateName : item.name}</span>
                </Link>
              );
            })}
            {isStaff && (
              <>
                <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Admin
                </div>
                {adminNavItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-[var(--tap-target-min)] items-center gap-3 rounded-lg px-3 py-2.5 pl-6 text-[length:var(--font-size-body)] font-medium transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}
            <div className="border-t border-border pt-2 mt-2">
              <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-[var(--tap-target-min)] items-center gap-3 rounded-lg px-3 py-2.5 text-[length:var(--font-size-body)] font-medium text-muted-foreground hover:bg-muted">
                <Settings className="h-5 w-5" /> Settings
              </Link>
              <button onClick={handleSignOut} className="flex min-h-[var(--tap-target-min)] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[length:var(--font-size-body)] font-medium text-muted-foreground hover:bg-muted">
                <LogOut className="h-5 w-5" /> Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </nav>
    <GlobalClientBanner />
    {effectiveOrgId && (
      <SearchBar
        organizationId={effectiveOrgId}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    )}
    <AdminOverlayHost
      open={nucleusOverlayOpen}
      onClose={() => setNucleusOverlayOpen(false)}
    />
    </>
  );
}
