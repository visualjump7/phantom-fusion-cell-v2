"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ALL_CATEGORIES = ["business", "personal", "family"];

export function useAllowedCategories(orgId: string | null): {
  allowedCategories: string[];
  isLoading: boolean;
} {
  const [allowedCategories, setAllowedCategories] = useState<string[]>(ALL_CATEGORIES);
  const [isLoading, setIsLoading] = useState(!!orgId);

  useEffect(() => {
    if (!orgId) {
      setAllowedCategories(ALL_CATEGORIES);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    db.from("client_profiles")
      .select("allowed_categories")
      .eq("organization_id", orgId)
      .single()
      .then(({ data, error }: { data: { allowed_categories: string[] | null } | null; error: unknown }) => {
        if (error || !data?.allowed_categories) {
          setAllowedCategories(ALL_CATEGORIES);
        } else {
          setAllowedCategories(data.allowed_categories);
        }
        setIsLoading(false);
      });
  }, [orgId]);

  return { allowedCategories, isLoading };
}
