"use client";

import { Construction } from "lucide-react";

export function UnderConstructionStub({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[40dvh] flex-col items-center justify-center gap-3 p-8 text-center">
      <Construction className="h-8 w-8 text-emerald-400/70" aria-hidden />
      <h3 className="text-lg font-semibold tracking-tight">
        {label} module — under construction
      </h3>
      <p className="max-w-sm text-sm text-white/60">
        This module will be available in a later phase of the v1 build.
        Close this panel to return to the nucleus.
      </p>
    </div>
  );
}

export default UnderConstructionStub;
