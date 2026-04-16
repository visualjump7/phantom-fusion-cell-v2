"use client";

/**
 * /nucleus — principal-first entry point.
 *
 * Server-side would be preferable, but the orbital nucleus relies on
 * client hooks (useRole, useEffectiveOrgId, reduced-motion detection,
 * viewport size) so the page stays a client component for now. Role +
 * org resolution happens via the existing client hooks.
 *
 * onModuleClick routes to the target path for Dashboard (which always
 * leaves nucleus) and falls back to console.info() for overlay-bound
 * modules until Phase 3 wires the focused overlay.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { getVisibleModulesForUser } from "@/lib/module-visibility-service";
import { MODULE_METADATA } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import { OrbitalNucleus } from "@/components/nucleus/OrbitalNucleus";

export default function NucleusPage() {
  const router = useRouter();
  const { role, userId, isLoading: roleLoading } = useRole();
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();

  const [visibleModules, setVisibleModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Placeholder until Phase 3 lands the FocusedOverlay — we still track the
  // active module so clicks feel responsive and we can log behavior in dev.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);

  const isAdminSide = useMemo(
    () => ["admin", "owner", "manager"].includes((role ?? "").toLowerCase()),
    [role]
  );

  useEffect(() => {
    if (roleLoading || orgLoading) return;
    if (!userId || !orgId) {
      // Fall back to admin "all modules" shape if we can't resolve org —
      // principals will effectively get the default-visible trio via the
      // service's buildDefaultConfig path.
      setVisibleModules(isAdminSide ? [...ALL_MODULE_KEYS] : []);
      setLoading(false);
      return;
    }

    let cancelled = false;
    getVisibleModulesForUser(orgId, userId, role)
      .then((keys) => {
        if (!cancelled) {
          setVisibleModules(keys);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[nucleus] getVisibleModulesForUser failed", err);
          setVisibleModules(isAdminSide ? [...ALL_MODULE_KEYS] : []);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roleLoading, orgLoading, userId, orgId, role, isAdminSide]);

  function handleModuleClick(key: ModuleKey) {
    const meta = MODULE_METADATA[key];
    if (!meta) return;

    if (!meta.opensInOverlay) {
      // Dashboard (and any future non-overlay modules) exit nucleus entirely.
      router.push(meta.routePath);
      return;
    }

    // Phase 3 will replace this with <FocusedOverlay open=...>.
    setActiveModule(key);
    // eslint-disable-next-line no-console
    console.info("[nucleus] module clicked (overlay stub):", key);
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-black">
        <div className="h-12 w-12 animate-pulse rounded-full border border-emerald-400/30" />
      </div>
    );
  }

  return (
    <OrbitalNucleus
      visibleModules={visibleModules}
      onModuleClick={handleModuleClick}
      mode={isAdminSide ? "admin" : "principal"}
    />
  );
}
