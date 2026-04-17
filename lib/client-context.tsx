"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ClientContextValue {
  orgId: string;
  clientName: string;
  accentColor: string;
  status: string;
  isLoading: boolean;
  /** Let consumers (e.g. an inline rename form) update the displayed
   *  client name after persisting to the DB, so the banner and any
   *  heading using clientName refresh instantly without a route reload. */
  setClientName: (name: string) => void;
}

export const ClientContext = createContext<ClientContextValue | null>(null);

interface ClientContextProviderProps {
  orgId: string;
  children: ReactNode;
}

export function ClientContextProvider({ orgId, children }: ClientContextProviderProps) {
  const [clientName, setClientName] = useState("");
  const [accentColor, setAccentColor] = useState("amber");
  const [status, setStatus] = useState("active");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await db
        .from("client_profiles")
        .select("display_name, accent_color, status")
        .eq("organization_id", orgId)
        .single();

      if (error || !data) {
        // Fallback: try organization name directly
        const { data: org } = await db
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single();

        setClientName(org?.name || "Unknown Principal");
        setIsLoading(false);
        return;
      }

      setClientName(data.display_name);
      setAccentColor(data.accent_color || "amber");
      setStatus(data.status || "active");
      setIsLoading(false);
    }

    loadProfile();
  }, [orgId]);

  return (
    <ClientContext.Provider
      value={{ orgId, clientName, accentColor, status, isLoading, setClientName }}
    >
      {children}
    </ClientContext.Provider>
  );
}
