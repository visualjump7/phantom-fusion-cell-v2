"use client";

/**
 * OrbitalNucleus — the principal's entry point.
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

export type NucleusMode = "principal" | "admin" | "preview";

export interface OrbitalNucleusProps {
  visibleModules: string[];
  onModuleClick: (key: ModuleKey) => void;
  onOrbClick?: () => void;
  mode?: NucleusMode;
  centerLogoSrc?: string;
}

const ORBIT_RADIUS_DESKTOP = 280; // px
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

export function OrbitalNucleus({
  visibleModules,
  onModuleClick,
  onOrbClick,
  mode = "principal",
  centerLogoSrc,
}: OrbitalNucleusProps) {
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
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-black"
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
        />
      ) : (
        <DesktopOrbit
          modules={modules}
          positions={positions}
          onModuleClick={onModuleClick}
          onOrbClick={onOrbClick}
          centerLogoSrc={centerLogoSrc}
          reduce={!!reduce}
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
}: {
  modules: ModuleMeta[];
  positions: number[];
  onModuleClick: (key: ModuleKey) => void;
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
          const x2 = Math.cos(rad) * r;
          const y2 = Math.sin(rad) * r;
          return (
            <line
              key={m.key}
              className="fc-nucleus-line"
              x1={0}
              y1={0}
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

      {/* Module nodes — positioning is on the outer <div> so Framer Motion's
          scale transform on the inner motion.button doesn't clobber it. */}
      {modules.map((m, i) => {
        const rad = (positions[i] * Math.PI) / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
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
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: reduce ? 0 : 0.08 * i,
                duration: 0.35,
                ease: "easeOut",
              }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              aria-label={`Open ${m.label}`}
            >
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/80 backdrop-blur-sm transition-[box-shadow,border-color] duration-200 hover:border-emerald-400/40"
                style={{
                  boxShadow: `0 0 24px ${m.glow}`,
                }}
              >
                <m.icon className="h-6 w-6 text-white" aria-hidden />
              </span>
              <span className="whitespace-nowrap text-xs font-medium text-white/80">
                {m.label}
              </span>
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
}: {
  modules: ModuleMeta[];
  onModuleClick: (key: ModuleKey) => void;
  onOrbClick?: () => void;
  centerLogoSrc?: string;
  reduce: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-start gap-10 px-6 pb-16 pt-10">
      <CenterOrb onClick={onOrbClick} centerLogoSrc={centerLogoSrc} reduce={reduce} compact />
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        {modules.map((m, i) => (
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
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-4 transition hover:border-emerald-400/40 active:scale-[0.98]"
            aria-label={`Open ${m.label}`}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/80"
              style={{ boxShadow: `0 0 20px ${m.glow}` }}
            >
              <m.icon className="h-5 w-5 text-white" aria-hidden />
            </span>
            <span className="text-xs font-medium text-white/80">{m.label}</span>
          </motion.button>
        ))}
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
        {centerLogoSrc && (
          <Image
            src={centerLogoSrc}
            alt="Fusion Cell"
            width={compact ? 40 : 56}
            height={compact ? 40 : 56}
            className="relative opacity-95"
          />
        )}
        {/* No icon by default — the orb itself is the affordance. */}
      </motion.button>
    </div>
  );
}

export default OrbitalNucleus;
