"use client";

/**
 * AdminSettingsMenu — dropdown items + controllers for the three admin
 * affordances that used to live inline on the navbar:
 *
 *   - Open Nucleus            (mounts NucleusOverlayHost)
 *   - View as Principal       (list of active principals, or immediate
 *                              activation if only one exists)
 *   - Land on Nucleus / Dashboard (toggle profiles.default_landing)
 *
 * To survive the settings dropdown closing on click, the actual nucleus
 * overlay is rendered by <AdminOverlayHost /> mounted at Navbar level.
 * The menu items just call openNucleus() / activatePrincipal() via
 * callbacks passed in by the Navbar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleDot,
  Eye,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import { fetchClientProfiles, type ClientProfile } from "@/lib/client-service";
import { supabase } from "@/lib/supabase";
import { usePreview } from "@/lib/preview-context";
import {
  getDefaultLanding,
  setDefaultLanding,
  type DefaultLanding,
} from "@/lib/profile-service";
import { OrbitalCommand } from "@/components/command/OrbitalCommand";
import { FocusedOverlay } from "@/components/command/FocusedOverlay";
import {
  CommandProvider,
  useCommand,
} from "@/components/command/CommandContext";
import { getModuleContent } from "@/components/command/module-content";
import { MODULE_METADATA } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PrincipalOption {
  orgId: string;
  name: string;
  accent: string;
}

type AdminNavItem = { name: string; href: string; icon: LucideIcon };

const ADMIN_TOP_NAV: AdminNavItem = {
  name: "Admin",
  href: "/admin",
  icon: ShieldCheck,
};
const ADMIN_BOTTOM_NAV: AdminNavItem = {
  name: "Budget Editor",
  href: "/budget-editor",
  icon: FileSpreadsheet,
};

// ============================================
// <AdminSettingsMenu /> — items rendered inside the Navbar settings panel
// ============================================

export function AdminSettingsMenu({
  onOpenNucleus,
  onRequestClose,
}: {
  onOpenNucleus: () => void;
  onRequestClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isStaff, userId } = useRole();
  const { enterPreview, active: previewActive } = usePreview();

  const [principals, setPrincipals] = useState<PrincipalOption[]>([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(true);
  const [showPrincipalList, setShowPrincipalList] = useState(false);

  const [landing, setLanding] = useState<DefaultLanding>("command");
  const [landingLoading, setLandingLoading] = useState(true);
  const [landingSaving, setLandingSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchClientProfiles()
      .then((rows) => {
        if (cancelled) return;
        const active = (rows as ClientProfile[]).filter(
          (r) => r.status === "active" || r.status === "onboarding"
        );
        setPrincipals(
          active.map((r) => ({
            orgId: r.organization_id,
            name: r.display_name,
            accent: r.accent_color || "#4ADE80",
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingPrincipals(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getDefaultLanding(userId).then((v) => {
      if (!cancelled) {
        setLanding(v);
        setLandingLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activatePrincipal = useCallback(
    async (opt: PrincipalOption) => {
      onRequestClose();
      const { data } = await db
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", opt.orgId)
        .eq("role", "executive")
        .limit(1);
      const principalId = data?.[0]?.user_id;
      if (!principalId) {
        console.warn("[view-as-principal] no executive found for org", opt.orgId);
        return;
      }
      await enterPreview({
        principalId,
        principalName: opt.name,
        orgId: opt.orgId,
      });
      router.push("/command");
      router.refresh();
    },
    [enterPreview, onRequestClose, router]
  );

  const handleViewAsPrincipal = useCallback(() => {
    if (principals.length === 0) return;
    if (principals.length === 1) {
      activatePrincipal(principals[0]);
      return;
    }
    setShowPrincipalList((v) => !v);
  }, [principals, activatePrincipal]);

  const handleToggleLanding = useCallback(async () => {
    if (!userId || landingSaving || landingLoading) return;
    const next: DefaultLanding = landing === "command" ? "dashboard" : "command";
    setLandingSaving(true);
    setLanding(next);
    const res = await setDefaultLanding(userId, next);
    if (!res.success) {
      setLanding(landing);
    }
    setLandingSaving(false);
  }, [userId, landing, landingSaving, landingLoading]);

  if (!isStaff) return null;

  const renderAdminNavLink = (nav: AdminNavItem) => {
    const isActive = pathname ? pathname.startsWith(nav.href) : false;
    return (
      <Link
        href={nav.href}
        onClick={onRequestClose}
        className={cn(
          "flex min-h-[var(--tap-target-min)] items-center gap-2 px-3 py-2 text-[length:var(--font-size-body)] font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground hover:bg-muted"
        )}
      >
        <nav.icon className="h-4 w-4" />
        {nav.name}
      </Link>
    );
  };

  return (
    <>
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Admin
      </div>

      {renderAdminNavLink(ADMIN_TOP_NAV)}

      {!previewActive && (
        <button
          type="button"
          onClick={handleViewAsPrincipal}
          disabled={loadingPrincipals || principals.length === 0}
          className="flex min-h-[var(--tap-target-min)] w-full items-center gap-2 px-3 py-2 text-[length:var(--font-size-body)] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Eye className="h-4 w-4 text-emerald-400" />
          <span className="flex-1 text-left">View as Principal</span>
          {principals.length > 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      {!previewActive && showPrincipalList && principals.length > 1 && (
        <div className="mx-1 mb-1 rounded-md border border-border/80 bg-muted/20">
          {principals.map((p) => (
            <button
              key={p.orgId}
              onClick={() => activatePrincipal(p)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition hover:bg-muted"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: p.accent }}
                aria-hidden
              />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {!previewActive && (
        <button
          type="button"
          onClick={() => {
            onRequestClose();
            onOpenNucleus();
          }}
          className="flex min-h-[var(--tap-target-min)] w-full items-center gap-2 px-3 py-2 text-[length:var(--font-size-body)] font-medium text-foreground transition-colors hover:bg-muted"
        >
          <CircleDot className="h-4 w-4 text-emerald-400" />
          Open Command Panel
        </button>
      )}

      <button
        type="button"
        onClick={handleToggleLanding}
        disabled={landingLoading || landingSaving}
        className="flex min-h-[var(--tap-target-min)] w-full items-center gap-2 px-3 py-2 text-[length:var(--font-size-body)] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        <LayoutDashboard
          className={cn(
            "h-4 w-4",
            landing === "dashboard" ? "text-emerald-400" : "text-muted-foreground"
          )}
        />
        <span className="flex-1 text-left">Land on Dashboard</span>
        {landingSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span
            role="switch"
            aria-checked={landing === "dashboard"}
            className={cn(
              "inline-flex h-5 w-9 items-center rounded-full transition",
              landing === "dashboard" ? "bg-emerald-500/80" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition",
                landing === "dashboard" ? "translate-x-5" : "translate-x-1"
              )}
            />
          </span>
        )}
      </button>

      {renderAdminNavLink(ADMIN_BOTTOM_NAV)}

      <div className="my-1 border-t border-border" />
    </>
  );
}

// ============================================
// <AdminOverlayHost /> — the full-viewport nucleus overlay
// ============================================

export function AdminOverlayHost({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <CommandProvider>
      <CommandOverlay onClose={onClose} />
    </CommandProvider>
  );
}

function CommandOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { activeModule, openModule, close: closeModule } = useCommand();

  const visibleModules = useMemo(() => [...ALL_MODULE_KEYS] as string[], []);

  function handleModuleClick(key: ModuleKey) {
    const meta = MODULE_METADATA[key];
    if (!meta) return;
    if (!meta.opensInOverlay) {
      onClose();
      router.push(meta.routePath);
      return;
    }
    openModule(key);
  }

  const activeMeta = activeModule ? MODULE_METADATA[activeModule] : null;

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close nucleus"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/80 backdrop-blur transition hover:border-emerald-400/40 hover:text-white"
        >
          <span className="text-lg">×</span>
        </button>
        <OrbitalCommand
          visibleModules={visibleModules}
          onModuleClick={handleModuleClick}
          mode="admin"
        />
      </div>

      <FocusedOverlay
        open={!!activeModule}
        onClose={closeModule}
        moduleLabel={activeMeta?.label ?? ""}
      >
        {activeModule ? getModuleContent(activeModule) : null}
      </FocusedOverlay>
    </div>
  );
}
