"use client";

/**
 * PreviewRouteGuard — while preview mode is active, any navigation to a
 * dashboard-style admin route bounces to /nucleus instead. Runs entirely
 * client-side; the server already allows the admin full access, we just
 * force the principal-perspective view on top.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePreview } from "@/lib/preview-context";

const ADMIN_PREFIXES = [
  "/dashboard",
  "/admin",
  "/budget-editor",
  "/globe",
  "/upload",
];

export function PreviewRouteGuard() {
  const { active } = usePreview();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!active) return;
    const blocked = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
    if (blocked) {
      router.replace("/command");
    }
  }, [active, pathname, router]);

  return null;
}

export default PreviewRouteGuard;
