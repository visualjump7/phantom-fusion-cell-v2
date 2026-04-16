"use client";

/**
 * Top-of-viewport banner shown while an admin is in "View as Principal" mode.
 * Clicking anywhere on the banner exits preview and returns to the admin view.
 */

import { useRouter } from "next/navigation";
import { usePreview } from "@/lib/preview-context";

export function PreviewBanner() {
  const { active, principalName, exitPreview } = usePreview();
  const router = useRouter();

  if (!active) return null;

  async function handleExit() {
    await exitPreview();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      className="fixed inset-x-0 top-0 z-[60] flex h-9 w-full items-center justify-center gap-2 bg-black text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/40 transition hover:bg-emerald-500/10"
      aria-label="Exit preview mode"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
      Viewing as {principalName ?? "Principal"} — Click to exit preview.
    </button>
  );
}

export default PreviewBanner;
