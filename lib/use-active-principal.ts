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
import { supabase } from "@/lib/supabase";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
  const { isAdmin, isTeam } = useRole();

  useEffect(() => {
    const stored = readFromStorage();
    setActivePrincipalState(stored);
    setHydrated(true);
  }, []);

  const setActivePrincipal = useCallback(
    (principal: ActivePrincipal | null) => {
      if (!isAdmin && !isTeam && principal !== null) return;
      setActivePrincipalState(principal);
      writeToStorage(principal);
    },
    [isAdmin, isTeam]
  );

  const clearActivePrincipal = useCallback(() => {
    setActivePrincipalState(null);
    writeToStorage(null);
  }, []);

  // Clear stored principal only for executive/delegate (principal-side roles)
  const { isPrincipalSide } = useRole();
  useEffect(() => {
    if (hydrated && isPrincipalSide && activePrincipal !== null) {
      clearActivePrincipal();
    }
  }, [hydrated, isPrincipalSide, activePrincipal, clearActivePrincipal]);

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

// ============================================
// useUserAssignments — cached principal_assignments for current user
// ============================================

let cachedAssignments: string[] | null = null;

export function useUserAssignments(): { assignedOrgIds: string[]; isLoading: boolean } {
  const [assignedOrgIds, setAssignedOrgIds] = useState<string[]>(cachedAssignments || []);
  const [isLoading, setIsLoading] = useState(cachedAssignments === null);

  useEffect(() => {
    if (cachedAssignments !== null) {
      setAssignedOrgIds(cachedAssignments);
      setIsLoading(false);
      return;
    }

    async function fetch() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsLoading(false); return; }

        const { data, error } = await db
          .from("principal_assignments")
          .select("organization_id")
          .eq("user_id", user.id);

        if (error) { console.error("[useUserAssignments]", error); setIsLoading(false); return; }

        const ids = (data || []).map((r: { organization_id: string }) => r.organization_id);
        cachedAssignments = ids;
        setAssignedOrgIds(ids);
      } catch (err) {
        console.error("[useUserAssignments]", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, []);

  return { assignedOrgIds, isLoading };
}

export function clearAssignmentsCache() {
  cachedAssignments = null;
}

/**
 * Returns the org ID that data queries should scope to.
 * If an admin has an active principal selected, returns that principal's org.
 * Otherwise falls back to the user's own org from organization_members.
 */
export function useEffectiveOrgId(): { orgId: string | null; isLoading: boolean } {
  const { activePrincipal } = useActivePrincipal();
  const { isAdmin, isTeam } = useRole();
  const { orgId: userOrgId, isLoading } = useUserOrg();

  if ((isAdmin || isTeam) && activePrincipal) {
    return { orgId: activePrincipal.orgId, isLoading: false };
  }

  return { orgId: userOrgId, isLoading };
}

/**
 * Returns an org ID for conditional read filtering.
 * - Admin with principal selected → principal's orgId
 * - Admin without principal → null (show all data)
 * - Executive → user's own orgId
 * - Manager/Viewer with principal selected → activePrincipal's orgId
 * - Manager/Viewer without selection → first assigned orgId
 */
export function useScopedOrgId(): { scopedOrgId: string | null; isLoading: boolean } {
  const { activePrincipal } = useActivePrincipal();
  const { isAdmin, isExecutive, isManager, isViewer } = useRole();
  const { orgId: userOrgId, isLoading: orgLoading } = useUserOrg();
  const { assignedOrgIds, isLoading: assignLoading } = useUserAssignments();

  if (isAdmin && activePrincipal) {
    return { scopedOrgId: activePrincipal.orgId, isLoading: false };
  }

  if (isAdmin) {
    return { scopedOrgId: null, isLoading: false };
  }

  if (isExecutive) {
    return { scopedOrgId: userOrgId, isLoading: orgLoading };
  }

  if (isManager || isViewer) {
    if (activePrincipal) {
      return { scopedOrgId: activePrincipal.orgId, isLoading: false };
    }
    if (assignLoading) {
      return { scopedOrgId: null, isLoading: true };
    }
    if (assignedOrgIds.length > 0) {
      return { scopedOrgId: assignedOrgIds[0], isLoading: false };
    }
    return { scopedOrgId: null, isLoading: false };
  }

  return { scopedOrgId: null, isLoading: false };
}
