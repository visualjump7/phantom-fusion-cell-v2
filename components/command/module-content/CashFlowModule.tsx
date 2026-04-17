"use client";

import dynamic from "next/dynamic";

const CashFlowView = dynamic(
  () => import("@/app/cash-flow/page").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-400" />
      </div>
    ),
  }
);

export function CashFlowModule() {
  return (
    <div className="h-full w-full">
      <CashFlowView />
    </div>
  );
}

export default CashFlowModule;
