"use client";

import { useContext } from "react";
import { ClientContext, ClientContextValue } from "@/lib/client-context";

export function useClientContext(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) {
    throw new Error(
      "useClientContext must be used within a ClientContextProvider. " +
      "This hook is only available inside /admin/client/[orgId]/* routes."
    );
  }
  return ctx;
}
