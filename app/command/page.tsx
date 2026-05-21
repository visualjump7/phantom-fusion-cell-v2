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
import { BriefingCommand } from "@/components/command/BriefingCommand";
import { FocusedOverlay } from "@/components/command/FocusedOverlay";
import { CommandProvider, useCommand } from "@/components/command/CommandContext";
import { getModuleContent } from "@/components/command/module-content";
import { usePreview } from "@/lib/preview-context";
import { WelcomeOverlay } from "@/components/command/WelcomeOverlay";
import { fetchMessages } from "@/lib/message-service";
import { SearchBar } from "@/components/search/SearchBar";
import { CreateActionFAB } from "@/components/command/CreateActionFAB";
import { BackgroundGlobe } from "@/components/command/BackgroundGlobe";
import { PrincipalSummary } from "@/components/command/PrincipalSummary";
import {
  getVisibleSummaryCardsForPrincipal,
  type SummaryCardKey,
} from "@/lib/principal-summary-service";
import {
  getCommandLayout,
  getUserCommandLayout,
  DEFAULT_COMMAND_LAYOUT,
  type CommandLayout,
} from "@/lib/command-layout-service";
import {
  loadBriefingSnapshot,
  type BriefingSnapshot,
} from "@/lib/briefing-status-service";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
  // Summary cards to render below the orbital ring (principals only).
  // Empty array = nothing renders. Staff users never fetch this.
  const [summaryCards, setSummaryCards] = useState<SummaryCardKey[]>([]);
  // Layout chosen for this executive by the team. Defaults to 'orbital'.
  const [layout, setLayout] = useState<CommandLayout>(DEFAULT_COMMAND_LAYOUT);
  // First name for the briefing greeting. Pulled from profiles.full_name.
  const [firstName, setFirstName] = useState<string | null>(null);
  // Briefing-only data: chips, dynamic subhead, per-section meta. Only
  // loaded when layout === 'briefing' so the orbital path stays cheap.
  const [briefing, setBriefing] = useState<BriefingSnapshot | null>(null);

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

  // Load layout pref. Three cases:
  //   - Preview mode: take the previewed principal's principal_layout_config
  //     row (admin chose it for them — preview should mirror real exp).
  //   - Staff (admin / manager): take their OWN profiles.command_layout
  //     pref set in /settings → Appearance.
  //   - Executive: take their principal_layout_config row (team controls it).
  // All paths default to 'orbital' if nothing is set.
  useEffect(() => {
    if (preview.active) {
      if (!effectiveOrgForQuery || !effectiveUserId) {
        setLayout(DEFAULT_COMMAND_LAYOUT);
        return;
      }
      let cancelled = false;
      getCommandLayout(effectiveOrgForQuery, effectiveUserId).then((next) => {
        if (!cancelled) setLayout(next);
      });
      return () => {
        cancelled = true;
      };
    }
    if (effectiveIsAdminSide) {
      if (!userId) {
        setLayout(DEFAULT_COMMAND_LAYOUT);
        return;
      }
      let cancelled = false;
      getUserCommandLayout(userId).then((next) => {
        if (!cancelled) setLayout(next);
      });
      return () => {
        cancelled = true;
      };
    }
    if (!effectiveOrgForQuery || !effectiveUserId) {
      setLayout(DEFAULT_COMMAND_LAYOUT);
      return;
    }
    let cancelled = false;
    getCommandLayout(effectiveOrgForQuery, effectiveUserId).then((next) => {
      if (!cancelled) setLayout(next);
    });
    return () => {
      cancelled = true;
    };
  }, [
    preview.active,
    effectiveOrgForQuery,
    effectiveUserId,
    effectiveIsAdminSide,
    userId,
  ]);

  // First name for the briefing greeting. Only fetched when we're rendering
  // the briefing layout — saves a query on the orbital path. Falls back to
  // the email's local-part if full_name isn't set.
  useEffect(() => {
    if (layout !== "briefing" || !effectiveUserId) {
      setFirstName(null);
      return;
    }
    let cancelled = false;
    db
      .from("profiles")
      .select("full_name, email")
      .eq("id", effectiveUserId)
      .maybeSingle()
      .then(
        ({ data }: { data: { full_name: string | null; email: string | null } | null }) => {
          if (cancelled) return;
          const full = (data?.full_name || "").trim();
          if (full) {
            setFirstName(full.split(" ")[0]);
            return;
          }
          const email = data?.email || "";
          setFirstName(email ? email.split("@")[0] : null);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [layout, effectiveUserId]);

  // Briefing snapshot — chips, subhead, per-section meta. Skipped on the
  // orbital path so we don't run extra queries the layout doesn't use.
  useEffect(() => {
    if (layout !== "briefing" || !effectiveOrgForQuery) {
      setBriefing(null);
      return;
    }
    let cancelled = false;
    loadBriefingSnapshot(effectiveOrgForQuery, effectiveUserId ?? null)
      .then((snap) => {
        if (!cancelled) setBriefing(snap);
      })
      .catch((err) => {
        // Snapshot failure is non-fatal — the layout still renders with
        // defaults (greeting + module list, no chips / status meta).
        console.error("[command] loadBriefingSnapshot failed", err);
        if (!cancelled) setBriefing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [layout, effectiveOrgForQuery, effectiveUserId]);

  // Load principal-facing summary cards. Only fetch for principals (and
  // preview mode where we're acting as one) — staff never see these, so
  // don't hit the DB for them.
  useEffect(() => {
    if (!effectiveOrgForQuery || !effectiveUserId) {
      setSummaryCards([]);
      return;
    }
    const isPrincipalView =
      preview.active ||
      effectiveRole === "executive" ||
      effectiveRole === "delegate";
    if (!isPrincipalView) {
      setSummaryCards([]);
      return;
    }
    let cancelled = false;
    getVisibleSummaryCardsForPrincipal(effectiveOrgForQuery, effectiveUserId)
      .then((keys) => {
        if (!cancelled) setSummaryCards(keys);
      })
      .catch(() => {
        if (!cancelled) setSummaryCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveOrgForQuery, effectiveUserId, effectiveRole, preview.active]);

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
      {/* Text wordmark — matches the dashboard Navbar so branding is
          consistent across pages. Kept pointer-events-none so clicks pass
          through to the orbital UI behind it. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-6">
        <span className="text-2xl font-bold text-foreground">
          Fusion <span className="text-primary">Cell</span>
        </span>
      </div>
      {layout === "briefing" ? (
        <BriefingCommand
          visibleModules={visibleModules}
          onModuleClick={handleModuleClick}
          onOrbClick={() => setSearchOpen(true)}
          badges={badges}
          centerLogoSrc="/phantom-wings.svg"
          firstName={firstName}
          chips={briefing?.chips}
          subhead={briefing?.subhead}
          sections={briefing?.sections}
        />
      ) : (
        <OrbitalCommand
          visibleModules={visibleModules}
          onModuleClick={handleModuleClick}
          onOrbClick={() => setSearchOpen(true)}
          badges={badges}
          centerLogoSrc="/phantom-wings.svg"
          mode={preview.active ? "preview" : effectiveIsAdminSide ? "admin" : "principal"}
        />
      )}

      {/* Principal-only summary section — renders below the orbital ring
          when the admin has turned on any summary cards for this principal.
          If none are configured or the user is staff, this is a no-op. */}
      {effectiveOrgForQuery && summaryCards.length > 0 && (
        <PrincipalSummary
          orgId={effectiveOrgForQuery}
          visibleCards={summaryCards}
        />
      )}

      {/* Bottom tagline. When summary cards exist we let it sit at the end
          of the scroll (not fixed) so it doesn't float over the cards.
          When no summary cards, it stays pinned to the viewport bottom as
          a branding anchor. */}
      {summaryCards.length === 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-6">
          <span className="text-sm tracking-wide text-muted-foreground">
            Your world simplified.
          </span>
        </div>
      ) : (
        <div className="flex justify-center pb-8">
          <span className="text-sm tracking-wide text-muted-foreground">
            Your world simplified.
          </span>
        </div>
      )}
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
