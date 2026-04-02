"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useMotionValue, useAnimation, PanInfo } from "framer-motion";

interface BottomDrawerProps {
  children: React.ReactNode;
  /** Snap points as px values or "50%"/"92%" strings */
  snapPoints: (number | string)[];
  /** Index into snapPoints for default position */
  defaultSnap?: number;
  /** Callback when snap point changes */
  onSnapChange?: (snapIndex: number) => void;
}

export function BottomDrawer({
  children,
  snapPoints,
  defaultSnap = 0,
  onSnapChange,
}: BottomDrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const controls = useAnimation();
  const y = useMotionValue(0);

  // Convert snap points to pixel Y positions (from top of viewport)
  const getSnapPx = useCallback(
    (snap: number | string): number => {
      if (containerHeight === 0) return 0;
      if (typeof snap === "number") return containerHeight - snap;
      const pct = parseInt(snap) / 100;
      return containerHeight * (1 - pct);
    },
    [containerHeight]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      // Use dvh-equivalent: visualViewport for mobile browsers
      const h = window.visualViewport?.height ?? window.innerHeight;
      setContainerHeight(h);
    };
    update();

    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  // Snap to nearest point after drag ends
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const currentY = y.get();
      const velocity = info.velocity.y;
      const snapPxValues = snapPoints.map(getSnapPx);

      // Factor in velocity: fast swipe biases toward next snap
      let targetY = currentY;
      if (Math.abs(velocity) > 500) {
        targetY = velocity < 0 ? currentY - 100 : currentY + 100;
      }

      // Find closest snap point
      let closestIdx = 0;
      let closestDist = Infinity;
      snapPxValues.forEach((snapY, idx) => {
        const dist = Math.abs(targetY - snapY);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });

      setCurrentSnap(closestIdx);
      onSnapChange?.(closestIdx);
      controls.start({
        y: snapPxValues[closestIdx],
        transition: { type: "spring", damping: 30, stiffness: 300 },
      });
    },
    [y, snapPoints, getSnapPx, onSnapChange, controls]
  );

  // Animate to initial/default snap on mount or when snap changes externally
  useEffect(() => {
    if (containerHeight > 0) {
      const targetY = getSnapPx(snapPoints[defaultSnap]);
      controls.start({ y: targetY, transition: { duration: 0.3 } });
    }
  }, [containerHeight, defaultSnap, snapPoints, getSnapPx, controls]);

  // Public: programmatically snap to a specific index
  useEffect(() => {
    if (containerHeight > 0 && currentSnap !== defaultSnap) {
      // The parent can change defaultSnap to programmatically move the drawer
    }
  }, [currentSnap, defaultSnap, containerHeight]);

  if (containerHeight === 0) return null;

  const topSnap = getSnapPx(snapPoints[snapPoints.length - 1]);
  const bottomSnap = getSnapPx(snapPoints[0]);

  return (
    <motion.div
      className="absolute left-0 right-0 z-50 touch-none"
      style={{
        y,
        height: containerHeight,
        top: 0,
      }}
      drag="y"
      dragConstraints={{
        top: topSnap,
        bottom: bottomSnap,
      }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      animate={controls}
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl rounded-t-2xl border-t border-white/10" />

      {/* Drag handle */}
      <div className="relative flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-white/30" />
      </div>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="relative overflow-y-auto px-5 pb-8"
        style={{
          maxHeight: containerHeight * 0.85,
          paddingBottom: "max(32px, env(safe-area-inset-bottom))",
        }}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </motion.div>
  );
}
