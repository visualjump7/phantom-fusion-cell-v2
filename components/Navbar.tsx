"use client";

/**
 * Navbar — unified top bar across every breakpoint.
 *
 * Layout (left → right):
 *   Fusion Cell wordmark  …spacer…  [Delegate badge?]  [SearchTrigger?]  [☰]
 *
 * The wordmark links to the user's default landing (/command or /dashboard)
 * per profiles.default_landing. The hamburger opens <MobileNavDrawer />,
 * which is now the single source of all secondary navigation for both
 * mobile AND desktop — no more separate desktop horizontal nav or
 * settings dropdown.
 *
 * Also hosts the global chrome that used to live inside the old Navbar:
 *   - <GlobalClientBanner /> (global admin-view-as-principal banner)
 *   - <SearchBar /> modal (⌘K opens it)
 *   - <AdminOverlayHost /> (the command panel overlay, opened from the drawer)
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useRole } from "@/lib/use-role";
import { GlobalClientBanner } from "@/components/admin/shared/GlobalClientBanner";
import { SearchBar, SearchTrigger } from "@/components/search/SearchBar";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { AdminOverlayHost } from "@/components/admin/AdminSettingsMenu";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { useDefaultLanding } from "@/lib/use-default-landing";

export function Navbar() {
  const { isDelegate } = useRole();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [nucleusOverlayOpen, setNucleusOverlayOpen] = useState(false);
  const { href: homeHref } = useDefaultLanding();

  // Global ⌘K / Ctrl+K shortcut — still toggles the search modal.
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

  return (
    <>
      <nav
        className="sticky top-0 z-50 border-b border-border bg-background/95 text-foreground backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-2 md:h-16">
            {/* Logo — left justified, links to default landing. */}
            <Link href={homeHref} className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground md:text-lg">
                Fusion <span className="text-primary">Cell</span>
              </span>
            </Link>

            <div className="flex-1" />

            {isDelegate && (
              <span className="rounded-md bg-amber-600/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                Delegate
              </span>
            )}

            {effectiveOrgId && !isDelegate && (
              <SearchTrigger onClick={() => setSearchOpen(true)} />
            )}

            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={drawerOpen}
              className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      <GlobalClientBanner />

      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenNucleus={() => {
          setDrawerOpen(false);
          setNucleusOverlayOpen(true);
        }}
      />

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
