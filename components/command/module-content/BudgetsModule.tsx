"use client";

import dynamic from "next/dynamic";

const BudgetsView = dynamic(
  () => import("@/app/budget-editor/page").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-400" />
      </div>
    ),
  }
);

export function BudgetsModule() {
  return (
    <div className="h-full w-full">
      <BudgetsView />
    </div>
  );
}

export default BudgetsModule;
