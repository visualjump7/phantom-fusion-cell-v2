"use client";

/**
 * PreviewContext — state for admin "View as Principal" read-only session.
 *
 * When active:
 *   - getVisibleModulesForUser uses the previewed principal's config
 *   - /dashboard and other admin-only routes redirect to /nucleus
 *   - All write actions are blocked via useActionGuard
 *   - A persistent mint-on-black banner sits at the top of the viewport
 *
 * Persistence: sessionStorage, so preview dies on tab close (by design —
 * the audit log captures enter/exit pairs and we don't want a leaked tab
 * to keep someone impersonating a principal).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const STORAGE_KEY = "fusion-cell-preview-principal";

export interface PreviewState {
  active: boolean;
  principalId: string | null;
  principalName: string | null;
  orgId: string | null;
}

export interface PreviewContextValue extends PreviewState {
  enterPreview: (input: {
    principalId: string;
    principalName: string;
    orgId: string;
  }) => Promise<void>;
  exitPreview: () => Promise<void>;
}

const defaultState: PreviewState = {
  active: false,
  principalId: null,
  principalName: null,
  orgId: null,
};

const PreviewContext = createContext<PreviewContextValue>({
  ...defaultState,
  enterPreview: async () => {},
  exitPreview: async () => {},
});

function readState(): PreviewState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.principalId === "string") {
      return {
        active: true,
        principalId: parsed.principalId,
        principalName: parsed.principalName ?? null,
        orgId: parsed.orgId ?? null,
      };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

function writeState(state: PreviewState) {
  if (typeof window === "undefined") return;
  try {
    if (state.active) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

async function logAuditEvent(
  action: "preview.entered" | "preview.exited",
  principalId: string | null,
  orgId: string | null
): Promise<void> {
  if (!principalId || !orgId) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await db.from("audit_log").insert({
      organization_id: orgId,
      user_id: user.id,
      action,
      metadata: { principal_id: principalId },
    });
  } catch (err) {
    // Audit log is best-effort; don't block preview entry on failure.
    console.warn("[preview] audit log failed", err);
  }
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreviewState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readState());
    setHydrated(true);
  }, []);

  const enterPreview = useCallback(
    async ({
      principalId,
      principalName,
      orgId,
    }: {
      principalId: string;
      principalName: string;
      orgId: string;
    }) => {
      const next: PreviewState = {
        active: true,
        principalId,
        principalName,
        orgId,
      };
      setState(next);
      writeState(next);
      await logAuditEvent("preview.entered", principalId, orgId);
    },
    []
  );

  const exitPreview = useCallback(async () => {
    const prev = state;
    setState(defaultState);
    writeState(defaultState);
    if (prev.principalId && prev.orgId) {
      await logAuditEvent("preview.exited", prev.principalId, prev.orgId);
    }
  }, [state]);

  const value = useMemo<PreviewContextValue>(
    () => ({
      ...state,
      // Do not report active=true until after hydration so SSR matches the
      // client's first paint.
      active: hydrated && state.active,
      enterPreview,
      exitPreview,
    }),
    [state, hydrated, enterPreview, exitPreview]
  );

  return (
    <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
  );
}

export function usePreview(): PreviewContextValue {
  return useContext(PreviewContext);
}
