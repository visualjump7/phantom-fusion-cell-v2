"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "./use-role";
import { fetchDelegateAssetIds } from "./delegate-service";

interface UseDelegateAccessResult {
  assetIds: string[];
  isLoading: boolean;
  hasAccess: (assetId: string) => boolean;
}

let cachedDelegateAssets: string[] | null = null;

export function useDelegateAccess(): UseDelegateAccessResult {
  const { role, userId, isLoading: roleLoading } = useRole();
  const [assetIds, setAssetIds] = useState<string[]>(cachedDelegateAssets || []);
  const [isLoading, setIsLoading] = useState(role === "delegate" && cachedDelegateAssets === null);

  useEffect(() => {
    if (roleLoading) return;

    if (role !== "delegate") {
      setAssetIds([]);
      setIsLoading(false);
      return;
    }

    if (cachedDelegateAssets) {
      setAssetIds(cachedDelegateAssets);
      setIsLoading(false);
      return;
    }

    if (!userId) return;

    async function load() {
      const ids = await fetchDelegateAssetIds(userId!);
      cachedDelegateAssets = ids;
      setAssetIds(ids);
      setIsLoading(false);
    }
    load();
  }, [role, userId, roleLoading]);

  const hasAccess = useCallback(
    (assetId: string): boolean => {
      if (role !== "delegate") return true;
      return assetIds.includes(assetId);
    },
    [role, assetIds]
  );

  return { assetIds, isLoading, hasAccess };
}

export function clearDelegateCache() {
  cachedDelegateAssets = null;
}
