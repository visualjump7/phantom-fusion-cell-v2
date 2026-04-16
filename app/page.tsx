"use client";

/**
 * Fusion Cell — post-login home.
 *
 * This is the page every signed-in user lands on. It's a launcher / shortcut
 * hub: a pulsing mint orb (= Advanced Search, Phase B) at the center with
 * seven module nodes in orbit around it. Click the Dashboard node to drop
 * into the full rich dashboard (now at /dashboard). Other nodes link directly
 * to their modules in Phase A; Phase B will replace those links with in-page
 * fly-out panels.
 *
 * The visual reference is fusioncell-site/index.html. All styles live in
 * app/landing.css, scoped to the .fc-landing-shell wrapper so nothing leaks
 * to other routes.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  Wallet,
  Newspaper,
  Plane,
  Landmark,
  PieChart,
  Search,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useRole } from "@/lib/use-role";
import { useScopedOrgId, useEffectiveOrgId } from "@/lib/use-active-principal";
import { fetchMessages } from "@/lib/message-service";
import "./landing.css";

interface OrbitalNode {
  label: string;
  href: string;
  description: string;
  Icon: LucideIcon;
  angle: number; // degrees, 0 = 3 o'clock, -90 = 12 o'clock
  accent: string; // hex
  glow: string; // rgba with alpha
}

// 7 modules at 360/7 ≈ 51.43° spacing, clockwise from 12 o'clock.
// Order: Dashboard → Daily Brief → Alerts → Travel → Cash Flow → Budgets → Projects.
// Colors and icons are stable; only position around the ring changes.
const NODES: OrbitalNode[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "Overview of projects, total value, category breakdown.",
    Icon: LayoutDashboard,
    angle: -90,
    accent: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.18)",
  },
  {
    label: "Daily Brief",
    href: "/brief",
    description: "Morning summary of what needs your attention today.",
    Icon: Newspaper,
    angle: -38.57,
    accent: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.18)",
  },
  {
    label: "Alerts",
    href: "/messages",
    description: "Structured communications, decisions, action items.",
    Icon: Bell,
    angle: 12.86,
    accent: "#ef4444",
    glow: "rgba(239, 68, 68, 0.18)",
  },
  {
    label: "Travel",
    href: "/calendar",
    description: "Trips, itineraries, flights, accommodations.",
    Icon: Plane,
    angle: 64.29,
    accent: "#22d3ee",
    glow: "rgba(34, 211, 238, 0.18)",
  },
  {
    label: "Cashflow",
    href: "/cash-flow",
    description: "Obligations, invoices, calendar view.",
    Icon: Wallet,
    angle: 115.71,
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.18)",
  },
  {
    label: "Budgets",
    href: "/budget-editor",
    description: "Operating budgets, fixed and variable breakdowns, line items.",
    Icon: PieChart,
    angle: 167.14,
    accent: "#d946ef",
    glow: "rgba(217, 70, 239, 0.18)",
  },
  {
    label: "Projects",
    href: "/assets",
    description: "Properties, aircraft, vessels, vehicles, collections.",
    Icon: Landmark,
    angle: -141.43,
    accent: "#eab308",
    glow: "rgba(234, 179, 8, 0.18)",
  },
];

// SVG geometry — matches js/main.js in the static site. viewBox is 0 0 1000 1000
// and lines are drawn from ORB_R out to NODE_R along each node's angle.
const SVG_SIZE = 1000;
const ORB_R = 80;
const NODE_R = 420;

function lineCoords(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const cx = SVG_SIZE / 2;
  const cy = SVG_SIZE / 2;
  return {
    x1: cx + Math.cos(rad) * ORB_R,
    y1: cy + Math.sin(rad) * ORB_R,
    x2: cx + Math.cos(rad) * NODE_R,
    y2: cy + Math.sin(rad) * NODE_R,
  };
}

export default function OrbitalHomePage() {
  const router = useRouter();
  const { isDelegate } = useRole();
  const { scopedOrgId } = useScopedOrgId();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  // Delegates never see the orbital page — the full dashboard at /dashboard
  // also bounces them to /assets, keep the same behavior at the new home.
  useEffect(() => {
    if (isDelegate) router.replace("/assets");
  }, [isDelegate, router]);

  // Belt-and-braces: CSS already honors prefers-reduced-motion, but add a
  // class on the shell so the secondary rules match too.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) document.querySelector(".fc-landing-shell")?.classList.add("reduced");
  }, []);

  // Count of messages awaiting a response. Matches the "pending" definition
  // used on the full /messages page: type is decision or action_required,
  // and no response row exists yet.
  useEffect(() => {
    const orgId = scopedOrgId ?? effectiveOrgId;
    if (!orgId) return;
    let alive = true;
    fetchMessages({ organization_id: orgId })
      .then((msgs) => {
        if (!alive) return;
        const count = msgs.filter(
          (m) =>
            (m.type === "decision" || m.type === "action_required") && !m.response
        ).length;
        setPendingAlerts(count);
      })
      .catch(() => {
        /* leave badge at 0 on error */
      });
    return () => {
      alive = false;
    };
  }, [scopedOrgId, effectiveOrgId]);

  function highlight(i: number, on: boolean) {
    const line = lineRefs.current[i];
    if (!line) return;
    line.classList.toggle("hot", on);
  }

  function onOrbClick() {
    // Phase B: open the Advanced Search modal.
    // eslint-disable-next-line no-console
    console.info("[Fusion Cell] Advanced Search invoked");
  }

  return (
    <div className="fc-landing-shell">
      <div className="bg-glows" aria-hidden="true">
        <span className="glow three" />
        <span className="glow four" />
      </div>

      <main className="stage" aria-label="Fusion Cell overview">
        <div className="orbit" role="presentation">
          {/* Connecting lines (rendered statically — viewBox scales with SVG) */}
          <svg
            className="orbit-lines"
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {NODES.map((n, i) => {
              const c = lineCoords(n.angle);
              return (
                <line
                  key={n.label}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className="orbit-line"
                  data-i={i}
                  x1={c.x1}
                  y1={c.y1}
                  x2={c.x2}
                  y2={c.y2}
                  stroke={n.accent}
                  style={{ ["--i" as string]: i }}
                />
              );
            })}
          </svg>

          {/* Core orb — also the Advanced Search entry point. */}
          <button
            type="button"
            className="orb-core"
            onClick={onOrbClick}
            aria-label="Advanced Search"
          >
            <span className="orb-ring" aria-hidden="true" />
            <span className="orb-ring delay" aria-hidden="true" />
            <span className="orb" aria-hidden="true" />
            <span className="orb-label">Advanced Search</span>
          </button>

          {/* Orbital nodes */}
          <div className="nodes">
            {NODES.map((n, i) => (
              <Link
                key={n.label}
                href={n.href}
                className="node"
                style={{
                  ["--angle" as string]: `${n.angle}deg`,
                  ["--i" as string]: i,
                  ["--node-accent" as string]: n.accent,
                  ["--node-glow" as string]: n.glow,
                }}
                onMouseEnter={() => highlight(i, true)}
                onMouseLeave={() => highlight(i, false)}
                onFocus={() => highlight(i, true)}
                onBlur={() => highlight(i, false)}
              >
                <div className="node-inner">
                  <div className="node-head">
                    <span className="node-icon">
                      <n.Icon aria-hidden="true" />
                    </span>
                    <span className="node-label">{n.label}</span>
                    {n.label === "Alerts" && pendingAlerts > 0 && (
                      <span
                        className="node-badge"
                        aria-label={`${pendingAlerts} pending alert${pendingAlerts === 1 ? "" : "s"}`}
                      >
                        {pendingAlerts > 9 ? "9+" : pendingAlerts}
                      </span>
                    )}
                  </div>
                  <p className="node-desc">{n.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="wordmark">
          Fusion Cell
          <span className="dim">Your world, simplified.</span>
        </div>

        {/* Subtle prompt: the orb doubles as the search entry. Decorative —
            the real affordance is the hover label on the orb itself. */}
        <p
          style={{
            marginTop: 12,
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Tap the orb to search <ArrowRight size={12} aria-hidden="true" />
        </p>
      </main>
    </div>
  );
}
