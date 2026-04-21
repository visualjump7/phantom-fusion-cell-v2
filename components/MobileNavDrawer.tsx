"use client";

/**
 * MobileNavDrawer — right-slide-in persistent nav sidebar. All viewports.
 *
 * Persistent toggle behavior: opens on hamburger click, stays open while
 * the user navigates. Closes only via the hamburger (toggle), the sheet's
 * own X button, or Escape. No modal backdrop, no body-scroll lock — the
 * rest of the page remains interactive while the sidebar is open.
 *
 * Reads its item list from lib/nav-items.ts so the top bar, bottom tab
 * bar, and this drawer stay in lockstep.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/ui/nav-link";
import { mainNavItems, adminNavItems, type NavItem } from "@/lib/nav-items";
import { useRole, clearRoleCache } from "@/lib/use-role";
import { supabase } from "@/lib/supabase";
import { AdminSettingsMenu } from "@/components/admin/AdminSettingsMenu";

export interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Opens the command-panel overlay (rendered at Navbar level). */
  onOpenNucleus: () => void;
}

export function MobileNavDrawer({
  open,
  onClose,
  onOpenNucleus,
}: MobileNavDrawerProps) {
  const router = useRouter();
  const { isDelegate, isExecutive, isStaff } = useRole();

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const visibleMain = mainNavItems.filter((item) => {
    if (isDelegate) return item.delegateVisible;
    if (item.executiveOnly) return isExecutive;
    return true;
  });

  // Sign-out is a terminal action: close and bounce to /login.
  const handleSignOut = async () => {
    onClose();
    clearRoleCache();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Nav links do NOT auto-close the sidebar — it's persistent until the
  // user explicitly closes it.
  const renderNavLink = (item: NavItem, opts: { indent?: boolean } = {}) => {
    const label =
      isDelegate && item.delegateName ? item.delegateName : item.name;
    return (
      <NavLink
        key={item.href}
        href={item.href}
        icon={item.icon}
        className={cn(
          "flex min-h-[var(--tap-target-min)] items-center gap-3 rounded-lg px-3 py-2.5 text-[length:var(--font-size-body)] font-medium transition-colors",
          opts.indent && "pl-6"
        )}
        activeClassName="bg-primary/10 text-primary"
        inactiveClassName="text-foreground hover:bg-muted"
      >
        {label}
      </NavLink>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="drawer"
          className="fixed bottom-0 right-0 top-0 z-[60] flex h-full w-[85vw] max-w-[320px] flex-col border-l border-border bg-background shadow-2xl"
          role="navigation"
          aria-label="Main navigation"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          {/* Header — close button only; the top-bar wordmark already brands this surface. */}
          <div className="flex shrink-0 items-center justify-end border-b border-border px-3 py-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="space-y-1">
              {visibleMain.map((item) => renderNavLink(item))}
            </div>

            {isStaff && (
              <>
                <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </div>
                <div className="space-y-1">
                  {adminNavItems.map((item) =>
                    renderNavLink(item, { indent: true })
                  )}
                  <AdminSettingsMenu
                    onOpenNucleus={onOpenNucleus}
                    onRequestClose={onClose}
                  />
                </div>
              </>
            )}

            {isDelegate && (
              <div className="mt-3 px-3">
                <span className="inline-block rounded-md bg-amber-600/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  Delegate
                </span>
              </div>
            )}

            <div className="mt-4 space-y-1 border-t border-border pt-2">
              <NavLink
                href="/settings"
                icon={Settings}
                className="flex min-h-[var(--tap-target-min)] items-center gap-3 rounded-lg px-3 py-2.5 text-[length:var(--font-size-body)] font-medium transition-colors"
                activeClassName="bg-primary/10 text-primary"
                inactiveClassName="text-foreground hover:bg-muted"
              >
                Settings
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex min-h-[var(--tap-target-min)] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[length:var(--font-size-body)] font-medium text-red-400 transition-colors hover:bg-muted"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
