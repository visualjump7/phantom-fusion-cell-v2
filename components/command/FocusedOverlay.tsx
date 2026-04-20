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
import { ArrowLeft } from "lucide-react";
import { useCommand } from "./CommandContext";
import { OverlayNavMenu } from "./OverlayNavMenu";

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
  const { canGoBack, pop, navStack } = useCommand();

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
  const canPopInternal = allowInternalBack && canGoBack;
  // Single left-arrow affordance: pop the internal nav stack if there's one,
  // otherwise close the overlay and return to the command page.
  const handleBack = canPopInternal ? pop : onClose;
  const backAriaLabel = canPopInternal ? "Back" : "Back to command";

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

          {/* Panel — outer flex centers the inner motion.div so Framer Motion's
              scale transform doesn't collide with a centering translate. */}
          <div className="pointer-events-none absolute inset-0 flex items-stretch justify-stretch md:items-center md:justify-center md:p-6">
            <motion.div
              className="pointer-events-auto flex w-full h-[100dvh] flex-col overflow-hidden bg-black text-white md:h-[94dvh] md:max-h-[94vh] md:w-full md:max-w-[1400px] md:rounded-2xl md:border md:border-emerald-400/30 md:shadow-[0_20px_80px_rgba(74,222,128,0.18)]"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header — extra top padding on mobile to clear notch/status bar. */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 md:px-6 md:pt-4 md:pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label={backAriaLabel}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-base font-semibold tracking-tight md:text-lg">
                  {headerLabel}
                </h2>
              </div>
              <OverlayNavMenu align="right" />
            </div>

            {/* Body — scrollable. Bottom safe-area on mobile keeps content above home indicator. */}
            <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FocusedOverlay;
