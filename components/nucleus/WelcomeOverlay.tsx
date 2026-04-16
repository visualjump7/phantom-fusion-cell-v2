"use client";

/**
 * First-login welcome overlay shown on top of the nucleus for principals
 * whose profiles.has_seen_welcome is false. Dismissing persists the flag.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/use-role";
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/profile-service";
import { usePreview } from "@/lib/preview-context";

export function WelcomeOverlay() {
  const { role, userId, isLoading } = useRole();
  const preview = usePreview();
  const [show, setShow] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (isLoading || !userId) return;
    if (preview.active) return; // Don't fire for admins previewing principals
    if ((role ?? "").toLowerCase() !== "executive") return;
    hasSeenWelcome(userId).then((seen) => {
      if (!seen) setShow(true);
    });
  }, [isLoading, userId, role, preview.active]);

  async function dismiss() {
    if (!userId) return;
    setDismissing(true);
    await markWelcomeSeen(userId);
    setShow(false);
    setDismissing(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        >
          {/* Pulsing mint ring — draws attention to the orb through the overlay */}
          <motion.div
            aria-hidden
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-emerald-400/40"
          />

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative max-w-md rounded-2xl border border-emerald-400/30 bg-black p-6 text-center text-white shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Welcome to your Fusion Cell</h3>
            <p className="mt-2 text-sm text-white/70">
              Your team has set up your view. Tap any module to begin. The center orb is Advanced Search — ask it anything about your holdings, documents, or schedule.
            </p>
            <Button onClick={dismiss} disabled={dismissing} className="mt-6 w-full">
              {dismissing ? "Saving…" : "Got it"}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WelcomeOverlay;
