"use client";

/**
 * BriefingCommand — alternate /command layout.
 *
 * Two-column layout instead of the orbital ring:
 *   left  — NucleusOrb + greeting + dynamic subhead, status chips, search
 *           input placeholder, suggestion chips
 *   right — numbered SECTIONS index of the executive's visible modules,
 *           each row showing a one-line status + optional badge
 *
 * Rendered when principal_layout_config.layout = 'briefing' for the active
 * executive. Module visibility comes from principal_module_config — same
 * source the orbital layout uses — so the admin's per-executive picks apply
 * unchanged. Click behavior on section rows mirrors OrbitalCommand: modules
 * with opensInOverlay=true open in the focused overlay; the others route.
 */

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { MODULE_METADATA, type ModuleMeta } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import { NucleusOrb } from "@/components/command/NucleusOrb";
import { BriefingPrompt } from "@/components/command/BriefingPrompt";
import type {
  BriefingChips,
  SectionStatus,
} from "@/lib/briefing-status-service";

export interface BriefingCommandProps {
  visibleModules: string[];
  onModuleClick: (key: ModuleKey) => void;
  onOrbClick?: () => void;
  centerLogoSrc?: string;
  /** First name used in the greeting ("Welcome back, {firstName}."). */
  firstName?: string | null;
  /** Optional badge counts shown on the right side, keyed by module key. */
  badges?: Record<string, number>;
  /** Top-of-page status chips. Falsy values are filtered out. */
  chips?: BriefingChips | null;
  /** Dynamic green sub-line under the greeting. */
  subhead?: string;
  /** Right-column meta per module key. */
  sections?: Partial<Record<ModuleKey, SectionStatus>>;
}

interface ChipItem {
  key: string;
  label: string;
  /** "danger" turns the chip red — used when something is past due. */
  variant?: "danger" | "default";
}

function buildChips(chips: BriefingChips | null | undefined): ChipItem[] {
  if (!chips) return [];
  const items: ChipItem[] = [];
  if (chips.overdueCashFlow > 0) {
    items.push({
      key: "overdue",
      label: `${chips.overdueCashFlow} overdue`,
      variant: "danger",
    });
  }
  if (chips.pendingDecisions > 0) {
    items.push({
      key: "decisions",
      label: `${chips.pendingDecisions} ${chips.pendingDecisions === 1 ? "decision" : "decisions"}`,
    });
  }
  if (chips.actionItems > 0) {
    items.push({
      key: "actions",
      label: `${chips.actionItems} action ${chips.actionItems === 1 ? "item" : "items"}`,
    });
  }
  if (chips.nextTravel) {
    const t = chips.nextTravel;
    const suffix =
      t.daysAway === 0 ? "today" : t.daysAway === 1 ? "1d" : `${t.daysAway}d`;
    items.push({
      key: "travel",
      label: `${t.title} ${suffix}`,
    });
  }
  return items;
}

export function BriefingCommand({
  visibleModules,
  onModuleClick,
  onOrbClick,
  centerLogoSrc,
  firstName,
  badges,
  chips,
  subhead,
  sections,
}: BriefingCommandProps) {
  const reduce = useReducedMotion();

  const modules = useMemo<ModuleMeta[]>(() => {
    const visible = new Set(visibleModules);
    return ALL_MODULE_KEYS.filter((k) => visible.has(k))
      .map((k) => MODULE_METADATA[k])
      .filter(Boolean);
  }, [visibleModules]);

  const greetingName = (firstName ?? "").trim();
  const chipItems = useMemo(() => buildChips(chips ?? null), [chips]);

  return (
    <div className="relative min-h-[100dvh] w-full">
      {/* Ambient mint glow consistent with orbital layout. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(74,222,128,0.05) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:gap-20 lg:px-12">
        {/* ─── Left column ───────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col items-start gap-8">
          <NucleusOrb
            onClick={onOrbClick}
            centerLogoSrc={centerLogoSrc}
            reduce={!!reduce}
            compact
          />

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {greetingName ? (
                <>Welcome back, {greetingName}.</>
              ) : (
                <>Welcome back.</>
              )}
            </h1>
            <p className="text-base font-medium text-emerald-400">
              {subhead || "Your day at a glance."}
            </p>
          </div>

          {/* Status chips — only render when there's at least one. The empty
              state is silence, not a "nothing here" placeholder. */}
          {chipItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chipItems.map((c) => (
                <span
                  key={c.key}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium " +
                    (c.variant === "danger"
                      ? "border-red-400/40 bg-red-500/10 text-red-300"
                      : "border-border bg-card/40 text-muted-foreground")
                  }
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}

          <BriefingPrompt />
        </div>

        {/* ─── Right column — section index ──────────────────────────── */}
        <div className="flex-1">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Sections
          </p>
          <ul className="divide-y divide-border/40 border-y border-border/40">
            {modules.length === 0 ? (
              <li className="py-6 text-sm text-muted-foreground">
                No modules enabled. Ask your team to turn some on.
              </li>
            ) : (
              modules.map((m, i) => {
                const explicitBadge = badges?.[m.key] ?? 0;
                const sectionMeta = sections?.[m.key];
                const sectionBadge = sectionMeta?.badge ?? 0;
                // Prefer explicit module badges (e.g. comms unread from
                // command/page.tsx) over section-derived ones. They mean the
                // same thing semantically and the explicit one is fresher.
                const badge = explicitBadge || sectionBadge;
                const badgeColor = sectionMeta?.badgeColor ?? "default";
                const summary = sectionMeta?.summary ?? "Open";

                return (
                  <li key={m.key}>
                    <button
                      type="button"
                      onClick={() => onModuleClick(m.key)}
                      className="group flex w-full items-center gap-4 py-4 text-left outline-none transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.04]"
                      aria-label={`Open ${m.label}${badge > 0 ? ` (${badge} pending)` : ""}`}
                    >
                      <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: m.accent }}
                      />
                      <span className="flex-1 text-base font-medium text-foreground">
                        {m.label}
                      </span>
                      <span
                        className={
                          "hidden text-xs sm:block " +
                          (badgeColor === "red"
                            ? "text-red-300"
                            : "text-muted-foreground/80")
                        }
                      >
                        {summary}
                      </span>
                      {badge > 0 && (
                        <span
                          className={
                            "flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold " +
                            (badgeColor === "red"
                              ? "border-red-400/60 bg-red-500/10 text-red-300"
                              : "border bg-black/40")
                          }
                          style={
                            badgeColor === "red"
                              ? undefined
                              : { borderColor: m.accent, color: m.accent }
                          }
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default BriefingCommand;
