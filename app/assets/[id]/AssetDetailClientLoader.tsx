"use client";

import { useState, useEffect, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

/**
 * Client-only lazy load without next/dynamic to avoid dev webpack chunk
 * desync (Cannot find module './NNNN.js') on the server bundle for this route.
 */
export function AssetDetailClientLoader() {
  const [Inner, setInner] = useState<ComponentType<object> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("./AssetDetailClient").then((m) => {
      if (!cancelled) setInner(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Inner) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Inner />;
}
