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
import { ALL_MODULE_KEYS, MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import { OrbitalCommand } from "@/components/command/OrbitalCommand";
import { FocusedOverlay } from "@/components/command/FocusedOverlay";
import { CommandProvider, useCommand } from "@/components/command/CommandContext";
import { getModuleContent } from "@/components/command/module-content";
import { usePreview } from "@/lib/preview-context";
import { WelcomeOverlay } from "@/components/command/WelcomeOverlay";
import { fetchMessages } from "@/lib/message-service";
import { SearchBar } from "@/components/search/SearchBar";
import { CreateActionFAB } from "@/components/command/CreateActionFAB";
import { BackgroundGlobe } from "@/components/command/BackgroundGlobe";

export default function CommandPage() {
  return (
    <CommandProvider>
      <CommandPageInner />
    </CommandProvider>
  );
}

function CommandPageInner() {
  const router = useRouter();
  const { role, userId, isLoading: roleLoading } = useRole();
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const preview = usePreview();
  const { activeModule, openModule, close } = useCommand();

  const [visibleModules, setVisibleModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [searchOpen, setSearchOpen] = useState(false);

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

  // Pull unresolved-decision count for the Comms badge. Matches the same
  // "pending" definition used elsewhere in the app.
  useEffect(() => {
    if (!effectiveOrgForQuery) return;
    let cancelled = false;
    fetchMessages({ organization_id: effectiveOrgForQuery })
      .then((msgs) => {
        if (cancelled) return;
        const pending = msgs.filter(
          (m) =>
            (m.type === "decision" || m.type === "action_required") &&
            !m.response
        ).length;
        setBadges((prev) => ({
          ...prev,
          [MODULE_KEYS.COMMS]: pending,
        }));
      })
      .catch(() => {
        /* leave badges empty on error */
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveOrgForQuery]);

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
      <BackgroundGlobe />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-6">
        <img
          src="https://phantom-presenter-assets.s3.us-east-1.amazonaws.com/Fusion+Cell+Logo.png"
          alt="Fusion Cell"
          className="h-12 w-auto"
        />
      </div>
      <OrbitalCommand
        visibleModules={visibleModules}
        onModuleClick={handleModuleClick}
        onOrbClick={() => setSearchOpen(true)}
        badges={badges}
        centerLogoSrc="/phantom-wings.svg"
        mode={preview.active ? "preview" : effectiveIsAdminSide ? "admin" : "principal"}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-6">
        <span className="text-sm tracking-wide text-muted-foreground">
          your world simplified
        </span>
      </div>
      <FocusedOverlay
        open={!!activeModule}
        onClose={close}
        moduleLabel={activeMeta?.label ?? ""}
      >
        {activeModule ? getModuleContent(activeModule) : null}
      </FocusedOverlay>
      {effectiveOrgForQuery && (
        <SearchBar
          organizationId={effectiveOrgForQuery}
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      )}
      <CreateActionFAB />
      <WelcomeOverlay />
    </>
  );
}
