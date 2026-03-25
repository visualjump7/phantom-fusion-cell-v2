"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  createElement,
} from "react";
import { useRole } from "@/lib/use-role";
import { useUserOrg } from "@/lib/use-user-org";

// ============================================
// Types
// ============================================

export interface ActivePrincipal {
  orgId: string;
  displayName: string;
  accentColor: string;
}

export interface ActivePrincipalContextValue {
  activePrincipal: ActivePrincipal | null;
  setActivePrincipal: (principal: ActivePrincipal | null) => void;
  clearActivePrincipal: () => void;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = "fusion-cell-active-principal";

// ============================================
// Context
// ============================================

const ActivePrincipalContext = createContext<ActivePrincipalContextValue>({
  activePrincipal: null,
  setActivePrincipal: () => {},
  clearActivePrincipal: () => {},
});

// ============================================
// Provider
// ============================================

interface ActivePrincipalProviderProps {
  children: ReactNode;
}

function readFromStorage(): ActivePrincipal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.orgId === "string" && typeof parsed.displayName === "string") {
      return parsed as ActivePrincipal;
    }
    return null;
  } catch {
    return null;
  }
}

function writeToStorage(principal: ActivePrincipal | null) {
  if (typeof window === "undefined") return;
  try {
    if (principal) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(principal));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function ActivePrincipalProvider({ children }: ActivePrincipalProviderProps) {
  const [activePrincipal, setActivePrincipalState] = useState<ActivePrincipal | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { isAdmin } = useRole();

  useEffect(() => {
    const stored = readFromStorage();
    setActivePrincipalState(stored);
    setHydrated(true);
  }, []);

  const setActivePrincipal = useCallback(
    (principal: ActivePrincipal | null) => {
      if (!isAdmin && principal !== null) return;
      setActivePrincipalState(principal);
      writeToStorage(principal);
    },
    [isAdmin]
  );

  const clearActivePrincipal = useCallback(() => {
    setActivePrincipalState(null);
    writeToStorage(null);
  }, []);

  // Clear stored principal if user is not admin (e.g. executive logged in)
  useEffect(() => {
    if (hydrated && !isAdmin && activePrincipal !== null) {
      clearActivePrincipal();
    }
  }, [hydrated, isAdmin, activePrincipal, clearActivePrincipal]);

  const value = useMemo(
    () => ({ activePrincipal, setActivePrincipal, clearActivePrincipal }),
    [activePrincipal, setActivePrincipal, clearActivePrincipal]
  );

  return createElement(ActivePrincipalContext.Provider, { value }, children);
}

// ============================================
// Hooks
// ============================================

export function useActivePrincipal(): ActivePrincipalContextValue {
  return useContext(ActivePrincipalContext);
}

/**
 * Returns the org ID that data queries should scope to.
 * If an admin has an active principal selected, returns that principal's org.
 * Otherwise falls back to the user's own org from organization_members.
 */
export function useEffectiveOrgId(): { orgId: string | null; isLoading: boolean } {
  const { activePrincipal } = useActivePrincipal();
  const { isAdmin } = useRole();
  const { orgId: userOrgId, isLoading } = useUserOrg();

  if (isAdmin && activePrincipal) {
    return { orgId: activePrincipal.orgId, isLoading: false };
  }

  return { orgId: userOrgId, isLoading };
}

/**
 * Returns an org ID for conditional read filtering.
 * - Admin with principal selected → principal's orgId (filter queries)
 * - Admin without principal → null (show all data, current behavior)
 * - Executive → user's own orgId (scope to their org)
 */
export function useScopedOrgId(): { scopedOrgId: string | null; isLoading: boolean } {
  const { activePrincipal } = useActivePrincipal();
  const { isAdmin, isExecutive } = useRole();
  const { orgId: userOrgId, isLoading } = useUserOrg();

  if (isAdmin && activePrincipal) {
    return { scopedOrgId: activePrincipal.orgId, isLoading: false };
  }

  if (isExecutive) {
    return { scopedOrgId: userOrgId, isLoading };
  }

  return { scopedOrgId: null, isLoading: false };
}
