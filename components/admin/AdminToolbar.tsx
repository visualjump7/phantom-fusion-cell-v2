"use client";

/**
 * AdminToolbar — two controls embedded in the admin Navbar (staff only):
 *   - "Open Nucleus": overlays the orbital nucleus over the current page
 *     (admin mode — every module visible) via a full-viewport overlay.
 *   - "View as Principal": flips the whole session into principal-perspective
 *     read-only mode. If the admin has multiple principals in reach, a
 *     dropdown lets them pick; if only one, activation is immediate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, Eye, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import { fetchClientProfiles, type ClientProfile } from "@/lib/client-service";
import { supabase } from "@/lib/supabase";
import { usePreview } from "@/lib/preview-context";
import { OrbitalNucleus } from "@/components/nucleus/OrbitalNucleus";
import { FocusedOverlay } from "@/components/nucleus/FocusedOverlay";
import {
  NucleusProvider,
  useNucleus,
} from "@/components/nucleus/NucleusContext";
import { getModuleContent } from "@/components/nucleus/module-content";
import { MODULE_METADATA } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PrincipalOption {
  orgId: string;
  name: string;
  accent: string;
}

export function AdminToolbar() {
  const { isStaff } = useRole();
  const { active: previewActive } = usePreview();
  const [showNucleus, setShowNucleus] = useState(false);

  if (!isStaff || previewActive) return null;

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <button
          type="button"
          onClick={() => setShowNucleus(true)}
          className="flex min-h-[var(--tap-target-min)] items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
          aria-label="Open nucleus overlay"
          title="Open nucleus overlay"
        >
          <CircleDot className="h-3.5 w-3.5" />
          <span>Nucleus</span>
        </button>
        <ViewAsPrincipalButton />
      </div>

      {showNucleus && (
        <NucleusProvider>
          <NucleusOverlay onClose={() => setShowNucleus(false)} />
        </NucleusProvider>
      )}
    </>
  );
}

// ============================================
// Nucleus overlay (admin mode — all modules)
// ============================================

function NucleusOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { activeModule, openModule, close: closeModule } = useNucleus();

  // Admin sees every module regardless of any principal_module_config rows.
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
      {/* Full-viewport black canvas housing the orbital nucleus */}
      <div className="absolute inset-0 bg-black">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close nucleus"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/80 backdrop-blur transition hover:border-emerald-400/40 hover:text-white"
        >
          <span className="text-lg">×</span>
        </button>
        <OrbitalNucleus
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

// ============================================
// View as Principal button + principal picker
// ============================================

function ViewAsPrincipalButton() {
  const router = useRouter();
  const { enterPreview } = usePreview();
  const [open, setOpen] = useState(false);
  const [principals, setPrincipals] = useState<PrincipalOption[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Load once on mount so activation is snappy even if the dropdown is never opened.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const activate = useCallback(
    async (opt: PrincipalOption) => {
      setOpen(false);
      // Resolve the principal user_id from organization_members (one executive per org).
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
      router.push("/nucleus");
      router.refresh();
    },
    [enterPreview, router]
  );

  function handleButton() {
    if (principals.length === 0) return;
    if (principals.length === 1) {
      activate(principals[0]);
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={handleButton}
        disabled={loading || principals.length === 0}
        className={cn(
          "flex min-h-[var(--tap-target-min)] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-emerald-400/40 hover:text-white disabled:opacity-40",
        )}
        aria-label="View as principal"
        title="View as principal"
      >
        <Eye className="h-3.5 w-3.5" />
        <span>View as Principal</span>
        {principals.length > 1 && <ChevronDown className="h-3 w-3" />}
      </button>

      {open && principals.length > 1 && (
        <div className="absolute right-0 top-full mt-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          {principals.map((p) => (
            <button
              key={p.orgId}
              onClick={() => activate(p)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
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
    </div>
  );
}

export default AdminToolbar;
