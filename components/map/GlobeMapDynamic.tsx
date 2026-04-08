"use client";

import { useState, useEffect, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { GlobeMapProps } from "./GlobeMap";

/**
 * Loads GlobeMap only on the client via dynamic import() in useEffect.
 * Avoids next/dynamic's server chunk graph, which can hit missing chunk files
 * in dev when .next cache and HMR get out of sync (e.g. Cannot find module './9380.js').
 */
export function GlobeMapDynamic(props: GlobeMapProps) {
  const [Globe, setGlobe] = useState<ComponentType<GlobeMapProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("./GlobeMap").then((m) => {
      if (!cancelled) setGlobe(() => m.GlobeMap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const h = props.height ?? "45vh";
  if (!Globe) {
    return (
      <div className="flex w-full items-center justify-center bg-black/80" style={{ height: h }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Globe {...props} />;
}
