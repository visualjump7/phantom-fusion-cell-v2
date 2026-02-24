"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Calendar as CalendarIcon,
  MessageSquare,
  Upload,
  FileSpreadsheet,
  SendHorizontal,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
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

// CLIENT sees: Dashboard, Assets, Calendar, Messages
// ADMIN sees: everything + Upload, Bills, Compose
const allNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Assets", href: "/assets", icon: Building2 },
  { name: "Calendar", href: "/calendar", icon: CalendarIcon },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Upload", href: "/upload", icon: Upload, adminOnly: true },
  { name: "Bills", href: "/admin/bills", icon: FileSpreadsheet, adminOnly: true },
  { name: "Compose", href: "/admin/messages", icon: SendHorizontal, adminOnly: true },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAdmin, isExecutive, userName, userEmail, isLoading, role } = useRole();

  // Filter: hide adminOnly items when user is NOT admin
  const navItems = allNavItems.filter((item) => {
    if (item.adminOnly) return isAdmin;
    return true;
  });

  const handleSignOut = async () => {
    clearRoleCache();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const displayName = userName || userEmail?.split("@")[0] || "";

  const roleLabel = isExecutive
    ? { text: "Client", color: "bg-violet-500/10 text-violet-400" }
    : isAdmin
    ? { text: "Admin", color: "bg-primary/10 text-primary" }
    : null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
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
            {navItems.map((item) => {
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
            {!isLoading && (
              <div className="hidden items-center gap-2 md:flex">
                {displayName && (
                  <span className="text-xs text-muted-foreground">{displayName}</span>
                )}
                {roleLabel && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleLabel.color}`}>
                    {roleLabel.text}
                  </span>
                )}
              </div>
            )}

            <Link
              href="/settings"
              className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:block"
            >
              <Settings className="h-5 w-5" />
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hidden text-muted-foreground md:flex"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>

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
          {!isLoading && displayName && (
            <div className="mb-3 flex items-center gap-2 px-3 pb-3 border-b border-border">
              <span className="text-sm text-foreground">{displayName}</span>
              {roleLabel && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${roleLabel.color}`}>
                  {roleLabel.text}
                </span>
              )}
            </div>
          )}
          <div className="space-y-1">
            {navItems.map((item) => {
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
