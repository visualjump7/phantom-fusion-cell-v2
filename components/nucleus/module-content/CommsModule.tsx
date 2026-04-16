"use client";

/**
 * Embeddable wrapper for the Comms (alerts + decisions) view.
 * Hydrates the existing /messages page inside the focused overlay.
 *
 * The direct route /messages continues to work for deep-linking; this
 * component simply renders the same content without the app chrome.
 */

import dynamic from "next/dynamic";

// Dynamic import so we don't drag server components into the overlay tree.
const MessagesView = dynamic(
  () => import("@/app/messages/page").then((m) => m.default),
  { ssr: false, loading: () => <ModuleLoader /> }
);

function ModuleLoader() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-400" />
    </div>
  );
}

export function CommsModule() {
  return (
    <div className="h-full w-full">
      <MessagesView />
    </div>
  );
}

export default CommsModule;
