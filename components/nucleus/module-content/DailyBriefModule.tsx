"use client";

import dynamic from "next/dynamic";

const BriefView = dynamic(
  () => import("@/app/brief/page").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-400" />
      </div>
    ),
  }
);

export function DailyBriefModule() {
  return (
    <div className="h-full w-full">
      <BriefView />
    </div>
  );
}

export default DailyBriefModule;
