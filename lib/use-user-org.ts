"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface UseUserOrgResult {
  orgId: string | null;
  isLoading: boolean;
}

let cachedOrgId: string | null = null;

export function useUserOrg(): UseUserOrgResult {
  const [orgId, setOrgId] = useState<string | null>(cachedOrgId);
  const [isLoading, setIsLoading] = useState(cachedOrgId === null);

  useEffect(() => {
    if (cachedOrgId) {
      setOrgId(cachedOrgId);
      setIsLoading(false);
      return;
    }

    async function fetchOrg() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setIsLoading(false);
          return;
        }

        const { data: membership, error: memberError } = await db
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .single();

        if (memberError || !membership) {
          setIsLoading(false);
          return;
        }

        cachedOrgId = membership.organization_id;
        setOrgId(membership.organization_id);
      } catch (error) {
        console.error("[useUserOrg] Error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrg();
  }, []);

  return { orgId, isLoading };
}

export function clearUserOrgCache() {
  cachedOrgId = null;
}
