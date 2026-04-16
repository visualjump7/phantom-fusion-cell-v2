"use client";

/**
 * FocusedOverlay — hybrid module container.
 *
 *   >=768px  centered panel, max 1200×90vh, rounded-2xl, mint 1px border,
 *            backdrop-blur over rgba(0,0,0,0.7). Clicking the backdrop closes.
 *   <768px   viewport-filling full-screen, no backdrop, no rounded corners.
 *
 * Header: (optional) back button + module label + close (X).
 * Escape key and X both fire onClose.
 * Framer Motion scale+fade on enter/exit (0.25s).
 */

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useNucleus } from "./NucleusContext";

export interface FocusedOverlayProps {
  open: boolean;
  onClose: () => void;
  moduleLabel: string;
  children: ReactNode;
  /**
   * When true, show the internal back button if the module has pushed any
   * entries onto its nav stack. Defaults to true.
   */
  allowInternalBack?: boolean;
}

export function FocusedOverlay({
  open,
  onClose,
  moduleLabel,
  children,
  allowInternalBack = true,
}: FocusedOverlayProps) {
  const { canGoBack, pop, navStack } = useNucleus();

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const headerLabel = navStack[navStack.length - 1]?.label ?? moduleLabel;
  const showBack = allowInternalBack && canGoBack;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay-root"
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={moduleLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop — desktop only (hidden on mobile where the panel is full-screen). */}
          <button
            type="button"
            aria-label="Close overlay"
            onClick={onClose}
            className="absolute inset-0 hidden bg-black/70 backdrop-blur-md md:block"
          />

          {/* Panel */}
          <motion.div
            className="absolute inset-0 flex h-[100dvh] w-full flex-col overflow-hidden border-0 bg-black text-white md:inset-auto md:left-1/2 md:top-1/2 md:h-[90dvh] md:max-h-[90vh] md:w-[min(1200px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-emerald-400/30 md:shadow-[0_20px_80px_rgba(74,222,128,0.15)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-3">
                {showBack && (
                  <button
                    type="button"
                    onClick={pop}
                    aria-label="Back"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <h2 className="text-base font-semibold tracking-tight md:text-lg">
                  {headerLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FocusedOverlay;
