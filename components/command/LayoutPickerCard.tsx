"use client";

/**
 * LayoutPickerCard — prominent two-up picker between the orbital and briefing
 * /command layouts. Used in two places with the SAME visual treatment:
 *
 *   /admin/client/[orgId]/principal-experience  (admin sets it for an executive)
 *   /settings → Appearance                       (admin picks their own)
 *
 * The previews are real SVG renderings of each layout's actual shape — a
 * miniature orbital ring and a miniature two-column briefing — so the choice
 * is obvious at a glance instead of relying on icon-pair guessing.
 */

import { Check, Loader2 } from "lucide-react";
import type { CommandLayout } from "@/lib/command-layout-service";

export interface LayoutPickerCardProps {
  /** Currently-selected layout. */
  value: CommandLayout;
  /** Called when the admin picks a different option. Caller handles
   *  optimistic update + rollback if the persist fails. */
  onChange: (next: CommandLayout) => void;
  /** Section heading. Tailor per location ("Command page layout" works for
   *  both call sites today). */
  title?: string;
  /** Subtitle / description text. */
  description?: string;
  /** Disable input while a save is in flight. */
  disabled?: boolean;
  /** Show the inline "Saving…" hint next to the title. */
  saving?: boolean;
}

interface OptionDef {
  value: CommandLayout;
  label: string;
  tagline: string;
  Preview: React.ComponentType<{ accentClass: string }>;
}

const OPTIONS: OptionDef[] = [
  {
    value: "orbital",
    label: "Orbital",
    tagline: "Modules circle the central orb.",
    Preview: OrbitalPreview,
  },
  {
    value: "briefing",
    label: "Briefing",
    tagline: "Greeting + numbered section list.",
    Preview: BriefingPreview,
  },
];

export function LayoutPickerCard({
  value,
  onChange,
  title = "Command page layout",
  description = "How the command page is arranged. Categories don't change — only the layout.",
  disabled = false,
  saving = false,
}: LayoutPickerCardProps) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-transparent p-5 sm:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {saving && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        )}
      </header>

      <div
        role="radiogroup"
        aria-label={title}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((opt) => {
          const isOn = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isOn}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={
                "group relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400/60 " +
                (isOn
                  ? "border-emerald-400/70 bg-emerald-400/[0.06] shadow-[0_0_28px_rgba(74,222,128,0.18)]"
                  : "border-border bg-card/60 hover:border-emerald-400/30 hover:bg-card/80") +
                (disabled ? " cursor-not-allowed opacity-60" : "")
              }
            >
              {/* Selected indicator — corner check, only when chosen. */}
              {isOn && (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-black shadow-md"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}

              {/* Real layout preview — SVG renders mirror the actual layouts. */}
              <div
                className={
                  "flex aspect-[2/1] w-full items-center justify-center rounded-lg border border-border/40 transition " +
                  (isOn ? "bg-black/60" : "bg-black/40 group-hover:bg-black/50")
                }
              >
                <opt.Preview
                  accentClass={isOn ? "text-emerald-400" : "text-muted-foreground/70"}
                />
              </div>

              <div>
                <p className="text-base font-semibold text-foreground">
                  {opt.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.tagline}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ============================================
// SVG previews — drawn on a 200×100 viewBox so both fit naturally in the
// `aspect-[2/1]` frame above. They're decorative, not interactive.
// ============================================

function OrbitalPreview({ accentClass }: { accentClass: string }) {
  // 8 dots evenly spaced around a ring centered at (100, 50), radius 34.
  const cx = 100;
  const cy = 50;
  const r = 34;
  const dotCount = 8;
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const a = (i / dotCount) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });

  return (
    <svg
      viewBox="0 0 200 100"
      className={"h-full w-full " + accentClass}
      aria-hidden
    >
      {/* Dashed ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 3"
      />
      {/* Center orb — radial gradient simulated with two stacked circles. */}
      <circle cx={cx} cy={cy} r="6" fill="currentColor" opacity="0.9" />
      <circle cx={cx} cy={cy} r="3" fill="white" opacity="0.6" />
      {/* Module nodes */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r="2.4"
          fill="currentColor"
          opacity="0.85"
        />
      ))}
    </svg>
  );
}

function BriefingPreview({ accentClass }: { accentClass: string }) {
  return (
    <svg
      viewBox="0 0 200 100"
      className={"h-full w-full " + accentClass}
      aria-hidden
    >
      {/* Left column — orb at top, then two stacked "text" bars (greeting +
          subhead). */}
      <circle cx="32" cy="28" r="9" fill="currentColor" opacity="0.9" />
      <circle cx="32" cy="28" r="4" fill="white" opacity="0.55" />
      <rect
        x="14"
        y="50"
        width="56"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity="0.65"
      />
      <rect
        x="14"
        y="60"
        width="38"
        height="4"
        rx="1.5"
        fill="currentColor"
        opacity="0.4"
      />
      {/* Vertical separator hint between the two columns */}
      <line
        x1="92"
        y1="14"
        x2="92"
        y2="86"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />
      {/* Right column — 5 numbered list rows, each = small dot + bar. */}
      {[18, 32, 46, 60, 74].map((y, i) => (
        <g key={i}>
          <circle cx="105" cy={y} r="1.6" fill="currentColor" opacity="0.85" />
          <rect
            x="112"
            y={y - 2}
            width={64 - i * 4}
            height="4"
            rx="1.5"
            fill="currentColor"
            opacity={0.7 - i * 0.06}
          />
        </g>
      ))}
    </svg>
  );
}
