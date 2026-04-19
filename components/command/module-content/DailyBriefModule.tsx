"use client";

/**
 * DailyBriefModule — overlay content for the Daily Brief nucleus button.
 *
 * Role branching:
 *   - Staff (admin/manager) → DailyBriefWorkspace (client picker + list +
 *     mini composer). Lets them create, edit, publish, and unpublish briefs
 *     without leaving the overlay.
 *   - Principals + viewers + anyone else → existing read-only BriefView
 *     (latest published brief + previous published briefs).
 */

import dynamic from "next/dynamic";
import { useRole } from "@/lib/use-role";
import { DailyBriefWorkspace } from "./daily-brief/DailyBriefWorkspace";

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
  const { isStaff, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-400" />
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="h-full w-full">
        <DailyBriefWorkspace />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <BriefView />
    </div>
  );
}

export default DailyBriefModule;
