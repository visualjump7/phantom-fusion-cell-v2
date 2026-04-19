"use client";

/**
 * OrbitalCommand — the principal's entry point.
 *
 * Renders a pulsing central orb (Advanced Search) surrounded by up to 9
 * module buttons. The visual treatment mirrors app/landing.css but the
 * component is self-contained (Tailwind + inline styles) so it can also
 * render inside an admin overlay or the View-as-Principal preview.
 *
 * Responsive:
 *   - >=768px : true orbital ring
 *   - <768px  : vertical scrollable hex grid (2-column)
 */

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  MODULE_METADATA,
  type ModuleMeta,
} from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";

export type CommandMode = "principal" | "admin" | "preview";

export interface OrbitalCommandProps {
  visibleModules: string[];
  onModuleClick: (key: ModuleKey) => void;
  onOrbClick?: () => void;
  mode?: CommandMode;
  centerLogoSrc?: string;
  /**
   * Optional per-module count badge, e.g. { comms: 6 } to show "6" on the
   * Alerts button. Zero / missing values render nothing.
   */
  badges?: Record<string, number>;
}

const ORBIT_RADIUS_DESKTOP = 320; // px
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function OrbitalCommand({
  visibleModules,
  onModuleClick,
  onOrbClick,
  mode = "principal",
  centerLogoSrc,
  badges,
}: OrbitalCommandProps) {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();

  // Keep canonical order from ALL_MODULE_KEYS regardless of input order.
  const modules = useMemo<ModuleMeta[]>(() => {
    const visible = new Set(visibleModules);
    return ALL_MODULE_KEYS.filter((k) => visible.has(k))
      .map((k) => MODULE_METADATA[k])
      .filter(Boolean);
  }, [visibleModules]);

  // Evenly distribute visible modules around a circle starting from -90deg (top).
  const positions = useMemo(() => {
    const step = modules.length > 0 ? 360 / modules.length : 0;
    return modules.map((_, i) => -90 + i * step);
  }, [modules]);

  return (
    <div
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
      data-nucleus-mode={mode}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(74,222,128,0.06) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      {isMobile ? (
        <MobileHexGrid
          modules={modules}
          onModuleClick={onModuleClick}
          onOrbClick={onOrbClick}
          centerLogoSrc={centerLogoSrc}
          reduce={!!reduce}
          badges={badges}
        />
      ) : (
        <DesktopOrbit
          modules={modules}
          positions={positions}
          onModuleClick={onModuleClick}
          onOrbClick={onOrbClick}
          centerLogoSrc={centerLogoSrc}
          reduce={!!reduce}
          badges={badges}
        />
      )}
    </div>
  );
}

// ============================================
// Desktop orbital ring
// ============================================

function DesktopOrbit({
  modules,
  positions,
  onModuleClick,
  onOrbClick,
  centerLogoSrc,
  reduce,
  badges,
}: {
  modules: ModuleMeta[];
  positions: number[];
  onModuleClick: (key: ModuleKey) => void;
  badges?: Record<string, number>;
  onOrbClick?: () => void;
  centerLogoSrc?: string;
  reduce: boolean;
}) {
  const r = ORBIT_RADIUS_DESKTOP;

  return (
    <div className="relative h-[720px] w-[720px] max-h-[90vh] max-w-[90vw]">
      {/* Orbit ring */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border border-white/5"
        style={{ boxShadow: "inset 0 0 60px rgba(74,222,128,0.04)" }}
      />

      {/* Orbit lines — dashed mint energy lines flowing outward from the core. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="-360 -360 720 720"
      >
        <style>{`
          @keyframes fc-nucleus-flow {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: -48; }
          }
          @keyframes fc-nucleus-line-fade {
            from { opacity: 0; }
            to   { opacity: 0.85; }
          }
          .fc-nucleus-line {
            stroke-dasharray: 4 8;
            opacity: 0;
            animation:
              fc-nucleus-line-fade 900ms cubic-bezier(.22,.61,.36,1) forwards,
              fc-nucleus-flow 3.6s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .fc-nucleus-line { animation: none; opacity: 0.6; }
          }
        `}</style>
        {modules.map((m, i) => {
          const rad = (positions[i] * Math.PI) / 180;
          const innerR = 82; // start just outside the 140px orb's bright edge
          const x1 = Math.cos(rad) * innerR;
          const y1 = Math.sin(rad) * innerR;
          const x2 = Math.cos(rad) * r;
          const y2 = Math.sin(rad) * r;
          return (
            <line
              key={m.key}
              className="fc-nucleus-line"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={m.accent}
              strokeOpacity={0.55}
              strokeWidth={1.25}
              style={{
                animationDelay: `${i * 120 + 600}ms, ${i * 400}ms`,
              }}
            />
          );
        })}
      </svg>

      {/* Central orb */}
      <CenterOrb onClick={onOrbClick} centerLogoSrc={centerLogoSrc} reduce={reduce} />

      {/* Module nodes — pill-shaped cards with accent-colored icon + label.
          Positioning lives on the outer <div> so Framer Motion's scale on the
          inner motion.button doesn't clobber it. */}
      {modules.map((m, i) => {
        const rad = (positions[i] * Math.PI) / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        const badge = badges?.[m.key] ?? 0;
        return (
          <div
            key={m.key}
            className="absolute"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
          >
            <motion.button
              type="button"
              onClick={() => onModuleClick(m.key)}
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: reduce ? 0 : 0.08 * i,
                duration: 0.35,
                ease: "easeOut",
              }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-left backdrop-blur-sm outline-none transition-[border-color] duration-200 hover:border-emerald-400/40 focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              style={{ boxShadow: `0 0 28px ${m.glow}` }}
              aria-label={`Open ${m.label}${badge > 0 ? ` (${badge} pending)` : ""}`}
            >
              <m.icon
                className="h-4 w-4 shrink-0"
                style={{ color: m.accent }}
                aria-hidden
              />
              <span className="text-sm font-semibold text-white">
                {m.label}
              </span>
              {badge > 0 && (
                <span
                  className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border bg-black/40 px-1.5 text-[11px] font-semibold"
                  style={{ borderColor: m.accent, color: m.accent }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Mobile hex-grid (vertical, scrollable)
// ============================================

function MobileHexGrid({
  modules,
  onModuleClick,
  onOrbClick,
  centerLogoSrc,
  reduce,
  badges,
}: {
  modules: ModuleMeta[];
  onModuleClick: (key: ModuleKey) => void;
  onOrbClick?: () => void;
  centerLogoSrc?: string;
  reduce: boolean;
  badges?: Record<string, number>;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-start gap-10 px-6 pb-16 pt-10">
      <CenterOrb onClick={onOrbClick} centerLogoSrc={centerLogoSrc} reduce={reduce} compact />
      <div className="flex w-full max-w-sm flex-col gap-3">
        {modules.map((m, i) => {
          const badge = badges?.[m.key] ?? 0;
          return (
            <motion.button
              key={m.key}
              type="button"
              onClick={() => onModuleClick(m.key)}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduce ? 0 : 0.08 * i,
                duration: 0.3,
                ease: "easeOut",
              }}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-left transition hover:border-emerald-400/40 active:scale-[0.98]"
              style={{ boxShadow: `0 0 20px ${m.glow}` }}
              aria-label={`Open ${m.label}${badge > 0 ? ` (${badge} pending)` : ""}`}
            >
              <m.icon
                className="h-4 w-4 shrink-0"
                style={{ color: m.accent }}
                aria-hidden
              />
              <span className="flex-1 text-sm font-semibold text-white">
                {m.label}
              </span>
              {badge > 0 && (
                <span
                  className="flex h-5 min-w-[20px] items-center justify-center rounded-full border bg-black/40 px-1.5 text-[11px] font-semibold"
                  style={{ borderColor: m.accent, color: m.accent }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Central orb (Advanced Search)
// ============================================

function CenterOrb({
  onClick,
  centerLogoSrc,
  reduce,
  compact = false,
}: {
  onClick?: () => void;
  centerLogoSrc?: string;
  reduce: boolean;
  compact?: boolean;
}) {
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

export default OrbitalCommand;
