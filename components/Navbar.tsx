"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Calendar as CalendarIcon,
  MessageSquare,
  TrendingUp,
  Receipt,
  SendHorizontal,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRole, clearRoleCache } from "@/lib/use-role";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const mainNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Directory", href: "/assets", icon: Building2 },
  { name: "Alerts", href: "/messages", icon: MessageSquare },
  { name: "Calendar", href: "/calendar", icon: CalendarIcon },
];

const adminNavItems: NavItem[] = [
  { name: "Budget", href: "/upload", icon: TrendingUp },
  { name: "Bills", href: "/admin/bills", icon: Receipt },
  { name: "Compose", href: "/admin/messages", icon: SendHorizontal },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useRole();

  useEffect(() => {
    if (!adminDropdownOpen && !settingsDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (adminDropdownOpen && adminDropdownRef.current && !adminDropdownRef.current.contains(e.target as Node)) {
        setAdminDropdownOpen(false);
      }
      if (settingsDropdownOpen && settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setSettingsDropdownOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [adminDropdownOpen, settingsDropdownOpen]);

  const handleSignOut = async () => {
    clearRoleCache();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="dark sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">Fusion Cell</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {mainNavItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="relative hidden md:block" ref={adminDropdownRef}>
                <button
                  type="button"
                  onClick={() => setAdminDropdownOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    adminNavItems.some((item) => pathname.startsWith(item.href))
                      ? "bg-primary/10 text-primary"
                      : "text-primary/70 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", adminDropdownOpen && "rotate-180")} />
                </button>
                {adminDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg"
                  >
                    {adminNavItems.map((item) => {
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setAdminDropdownOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                            isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            )}

            <div className="relative hidden md:block" ref={settingsDropdownRef}>
              <button
                type="button"
                onClick={() => setSettingsDropdownOpen((v) => !v)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Settings className="h-5 w-5" />
              </button>
              {settingsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg"
                >
                  <Link
                    href="/settings"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => { setSettingsDropdownOpen(false); handleSignOut(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:bg-muted transition-colors"
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
          className="dark border-t border-border bg-background px-4 py-4 md:hidden"
        >
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            {isAdmin && (
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
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 pl-6 text-sm font-medium transition-colors",
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
              <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                <Settings className="h-5 w-5" /> Settings
              </Link>
              <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                <LogOut className="h-5 w-5" /> Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
