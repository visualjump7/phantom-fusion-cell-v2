"use client";

/**
 * /nucleus — principal-first entry point.
 *
 * Wraps the orbital nucleus + focused overlay in a NucleusProvider so that
 * in-module navigation and cross-module inline-context links have shared
 * state. Dashboard remains a full-route navigation; every other module
 * opens inside the overlay.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { getVisibleModulesForUser } from "@/lib/module-visibility-service";
import { MODULE_METADATA } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import { OrbitalNucleus } from "@/components/nucleus/OrbitalNucleus";
import { FocusedOverlay } from "@/components/nucleus/FocusedOverlay";
import { NucleusProvider, useNucleus } from "@/components/nucleus/NucleusContext";
import { getModuleContent } from "@/components/nucleus/module-content";
import { usePreview } from "@/lib/preview-context";

export default function NucleusPage() {
  return (
    <NucleusProvider>
      <NucleusPageInner />
    </NucleusProvider>
  );
}

function NucleusPageInner() {
  const router = useRouter();
  const { role, userId, isLoading: roleLoading } = useRole();
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const preview = usePreview();
  const { activeModule, openModule, close } = useNucleus();

  const [visibleModules, setVisibleModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminSide = useMemo(
    () => ["admin", "owner", "manager"].includes((role ?? "").toLowerCase()),
    [role]
  );

  // Preview mode overrides: resolve against the previewed principal, always
  // use the "principal" perspective, and bypass the admin "all modules" path.
  const effectiveUserId = preview.active ? preview.principalId : userId;
  const effectiveOrgForQuery = preview.active ? preview.orgId : orgId;
  const effectiveRole = preview.active ? "executive" : role;
  const effectiveIsAdminSide = preview.active ? false : isAdminSide;

  useEffect(() => {
    if (roleLoading || orgLoading) return;
    if (!effectiveUserId || !effectiveOrgForQuery) {
      setVisibleModules(effectiveIsAdminSide ? [...ALL_MODULE_KEYS] : []);
      setLoading(false);
      return;
    }

    let cancelled = false;
    getVisibleModulesForUser(effectiveOrgForQuery, effectiveUserId, effectiveRole)
      .then((keys) => {
        if (!cancelled) {
          setVisibleModules(keys);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[nucleus] getVisibleModulesForUser failed", err);
          setVisibleModules(effectiveIsAdminSide ? [...ALL_MODULE_KEYS] : []);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    roleLoading,
    orgLoading,
    effectiveUserId,
    effectiveOrgForQuery,
    effectiveRole,
    effectiveIsAdminSide,
  ]);

  function handleModuleClick(key: ModuleKey) {
    const meta = MODULE_METADATA[key];
    if (!meta) return;

    if (!meta.opensInOverlay) {
      router.push(meta.routePath);
      return;
    }
    openModule(key);
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-black">
        <div className="h-12 w-12 animate-pulse rounded-full border border-emerald-400/30" />
      </div>
    );
  }

  const activeMeta = activeModule ? MODULE_METADATA[activeModule] : null;

  return (
    <>
      <OrbitalNucleus
        visibleModules={visibleModules}
        onModuleClick={handleModuleClick}
        mode={preview.active ? "preview" : effectiveIsAdminSide ? "admin" : "principal"}
      />
      <FocusedOverlay
        open={!!activeModule}
        onClose={close}
        moduleLabel={activeMeta?.label ?? ""}
      >
        {activeModule ? getModuleContent(activeModule) : null}
      </FocusedOverlay>
    </>
  );
}
