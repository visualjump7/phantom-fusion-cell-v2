"use client";

/**
 * useDefaultLanding — resolves the user's preferred landing page
 * ("/dashboard" or "/command") for use as the logo/home link target.
 *
 * Reads profiles.default_landing via getDefaultLanding() on mount,
 * caches the result in sessionStorage keyed by userId so the logo
 * href doesn't flicker to "/" on every page load while the async
 * lookup is in flight.
 */

import { useEffect, useState } from "react";
import { useRole } from "@/lib/use-role";
import { getDefaultLanding } from "@/lib/profile-service";

export type LandingHref = "/dashboard" | "/command" | "/";

const CACHE_PREFIX = "fc:default-landing:";

function readCache(userId: string | null | undefined): LandingHref {
  if (!userId || typeof window === "undefined") return "/";
  try {
    const v = sessionStorage.getItem(CACHE_PREFIX + userId);
    if (v === "/dashboard" || v === "/command") return v;
  } catch {
    // private mode / quota — ignore
  }
  return "/";
}

function writeCache(userId: string, href: LandingHref) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_PREFIX + userId, href);
  } catch {
    // ignore
  }
}

export function useDefaultLanding(): { href: LandingHref; loading: boolean } {
  const { userId } = useRole();
  const [href, setHref] = useState<LandingHref>(() => readCache(userId));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setHref("/");
      setLoading(false);
      return;
    }
    // Re-seed from cache if userId changed mid-session.
    const cached = readCache(userId);
    if (cached !== "/") setHref(cached);

    let cancelled = false;
    getDefaultLanding(userId).then((v) => {
      if (cancelled) return;
      const next: LandingHref = v === "dashboard" ? "/dashboard" : "/command";
      setHref(next);
      setLoading(false);
      writeCache(userId, next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { href, loading };
}
