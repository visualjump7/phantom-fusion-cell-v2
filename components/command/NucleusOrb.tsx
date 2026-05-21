"use client";

/**
 * NucleusOrb — the pulsing emerald orb at the center of /command.
 *
 * Originally lived inline as <CenterOrb> inside OrbitalCommand. Lifted out so
 * the alternate "briefing" layout (BriefingCommand) can render the same visual
 * without duplicating the ripple / glow / brand-wings choreography. Behavior
 * is identical to the previous inline component:
 *
 *   - 3-staggered ripple rings expanding outward
 *   - Soft radial glow that breathes with the pulse
 *   - The orb itself — radial-gradient fill, scale-pulse
 *   - Optional brand wings overlay that flares twice per ~5.5s cycle
 *
 * Reduced-motion: respects prefers-reduced-motion automatically — pass `reduce`
 * from useReducedMotion() at the call site.
 *
 * `compact` shrinks the orb to 96px and switches positioning to `relative`
 * for use inside flow layouts (mobile hex grid, briefing left column).
 */

import Image from "next/image";
import { motion } from "framer-motion";

export interface NucleusOrbProps {
  onClick?: () => void;
  centerLogoSrc?: string;
  reduce: boolean;
  /** Compact form (96px, relative positioning) for use inside flow layouts. */
  compact?: boolean;
}

export function NucleusOrb({
  onClick,
  centerLogoSrc,
  reduce,
  compact = false,
}: NucleusOrbProps) {
  const size = compact ? 96 : 140;
  const positionClass = compact
    ? "relative flex items-center justify-center"
    : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

  return (
    <div
      className={`${positionClass} pointer-events-none`}
      style={{ width: size, height: size }}
    >
      {/* Ripple rings — three staggered pulses expanding outward. */}
      {!reduce && (
        <>
          <motion.span
            aria-hidden
            className="absolute rounded-full border border-emerald-400/40"
            style={{ inset: -18 }}
            animate={{ scale: [0.85, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            aria-hidden
            className="absolute rounded-full border border-emerald-400/35"
            style={{ inset: -18 }}
            animate={{ scale: [0.85, 1.35], opacity: [0.45, 0] }}
            transition={{
              duration: 3.4,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1.1,
            }}
          />
          <motion.span
            aria-hidden
            className="absolute rounded-full border border-emerald-400/30"
            style={{ inset: -18 }}
            animate={{ scale: [0.85, 1.35], opacity: [0.35, 0] }}
            transition={{
              duration: 3.4,
              repeat: Infinity,
              ease: "easeOut",
              delay: 2.2,
            }}
          />
        </>
      )}

      {/* Soft radial glow underneath the core — breathes with the pulse. */}
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute rounded-full"
          style={{
            inset: -24,
            background:
              "radial-gradient(circle at 50% 50%, rgba(74,222,128,0.35) 0%, rgba(74,222,128,0.15) 38%, transparent 70%)",
            filter: "blur(6px)",
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* The orb itself — radial-gradient fill, scale-pulse. */}
      <motion.button
        type="button"
        onClick={onClick}
        aria-label="Open Advanced Search"
        className="pointer-events-auto relative flex h-full w-full items-center justify-center rounded-full border border-emerald-400/50 outline-none transition-[filter] duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400/60 hover:border-emerald-400/80"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(74,222,128,0.85) 0%, rgba(74,222,128,0.35) 28%, rgba(74,222,128,0.08) 58%, rgba(0,0,0,0.9) 82%)",
          boxShadow:
            "0 0 40px rgba(74,222,128,0.35), inset 0 0 30px rgba(74,222,128,0.25)",
        }}
        animate={
          reduce
            ? undefined
            : { scale: [1, 1.06, 1], opacity: [0.92, 1, 0.92] }
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
      >
        {/* No icon by default — the orb itself is the affordance. */}
      </motion.button>

      {/* Brand wings — sits ABOVE the orb so the orb pulses behind it.
          The wings themselves pulse on their own slower cadence: most of the
          time they hold a soft inner glow, then briefly flare brighter with
          a wider halo that extends outside the nucleus. pointer-events-none
          keeps the orb clickable through the graphic. */}
      {centerLogoSrc && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
          animate={
            reduce
              ? undefined
              : {
                  // Two flares per cycle so the brightening reads as
                  // intermittent, not a steady oscillation.
                  filter: [
                    "drop-shadow(0 0 8px rgba(74,222,128,0.4)) drop-shadow(0 0 16px rgba(74,222,128,0.15))",
                    "drop-shadow(0 0 18px rgba(74,222,128,0.95)) drop-shadow(0 0 42px rgba(74,222,128,0.6))",
                    "drop-shadow(0 0 8px rgba(74,222,128,0.4)) drop-shadow(0 0 16px rgba(74,222,128,0.15))",
                    "drop-shadow(0 0 8px rgba(74,222,128,0.4)) drop-shadow(0 0 16px rgba(74,222,128,0.15))",
                  ],
                  opacity: [0.85, 1, 0.85, 0.85],
                }
          }
          transition={{
            duration: 5.5,
            times: [0, 0.15, 0.3, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            filter: "drop-shadow(0 0 8px rgba(74,222,128,0.4))",
          }}
        >
          <Image
            src={centerLogoSrc}
            alt=""
            aria-hidden
            width={compact ? 180 : 300}
            height={compact ? 180 : 300}
            priority
            className="block select-none"
          />
        </motion.div>
      )}
    </div>
  );
}
