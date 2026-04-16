"use client";

/**
 * useActionGuard — hook for blocking write actions during preview mode.
 *
 * Usage:
 *   const { blocked, guardClick } = useActionGuard();
 *   <Button onClick={guardClick(() => save())} disabled={blocked} />
 *
 * When `blocked` is true, guardClick returns a handler that shows a
 * tooltip-style inline message instead of running the original handler.
 * Callers can check `blocked` directly to mute buttons visually.
 */

import { useCallback } from "react";
import { usePreview } from "@/lib/preview-context";

let lastToastAt = 0;

function showPreviewToast(message: string) {
  if (typeof window === "undefined") return;
  // Debounce: no more than one toast per 1.2s.
  const now = Date.now();
  if (now - lastToastAt < 1200) return;
  lastToastAt = now;

  const root = document.createElement("div");
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:32px",
    "transform:translateX(-50%)",
    "z-index:9999",
    "padding:10px 16px",
    "border-radius:9999px",
    "border:1px solid rgba(74,222,128,0.5)",
    "background:rgba(0,0,0,0.92)",
    "color:#4ADE80",
    "font-size:13px",
    "font-weight:500",
    "box-shadow:0 10px 30px rgba(0,0,0,0.5)",
    "pointer-events:none",
    "opacity:0",
    "transition:opacity 180ms ease",
  ].join(";");
  root.textContent = message;
  document.body.appendChild(root);
  requestAnimationFrame(() => {
    root.style.opacity = "1";
  });
  window.setTimeout(() => {
    root.style.opacity = "0";
    window.setTimeout(() => root.remove(), 220);
  }, 2200);
}

export function useActionGuard() {
  const { active } = usePreview();

  const guardClick = useCallback(
    <T extends (...args: any[]) => any>(handler: T) => {
      return ((...args: Parameters<T>) => {
        if (active) {
          showPreviewToast("Preview mode — actions disabled. Exit preview to make changes.");
          return;
        }
        return handler(...args);
      }) as T;
    },
    [active]
  );

  return {
    blocked: active,
    guardClick,
  } as const;
}

/**
 * Static helper for non-component contexts (e.g. form-submit handlers that
 * run inside useCallback/useEffect). Returns true if the action should
 * proceed; false if it was blocked.
 */
export function assertNotPreviewing(active: boolean, actionLabel = "This action"): boolean {
  if (active) {
    showPreviewToast(`${actionLabel} is disabled in preview mode.`);
    return false;
  }
  return true;
}
