"use client";

/**
 * NucleusContext — shared state between OrbitalNucleus and FocusedOverlay.
 *
 * Responsibilities:
 *   - Track which module is currently open inside the overlay.
 *   - Manage an internal navigation stack per module (list → detail → …)
 *     so the overlay header can show a back button.
 *   - Provide openModuleAt() for cross-module inline context so e.g. a
 *     decision in Comms can link to a Project detail view.
 *
 * Close of the overlay clears the internal nav stack; each module fresh-starts.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ModuleKey } from "@/lib/modules";

export interface ModuleNavEntry {
  path: string; // module-relative, e.g. "/detail/abc-123"
  label?: string; // optional header label override
}

export interface NucleusContextValue {
  activeModule: ModuleKey | null;
  navStack: ModuleNavEntry[];
  openModule: (key: ModuleKey) => void;
  openModuleAt: (key: ModuleKey, internalPath?: string, label?: string) => void;
  close: () => void;
  push: (entry: ModuleNavEntry) => void;
  pop: () => void;
  canGoBack: boolean;
}

const NucleusContext = createContext<NucleusContextValue | null>(null);

export function NucleusProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
  const [navStack, setNavStack] = useState<ModuleNavEntry[]>([]);

  const openModule = useCallback((key: ModuleKey) => {
    setActiveModule(key);
    setNavStack([]);
  }, []);

  const openModuleAt = useCallback(
    (key: ModuleKey, internalPath?: string, label?: string) => {
      setActiveModule(key);
      setNavStack(internalPath ? [{ path: internalPath, label }] : []);
    },
    []
  );

  const close = useCallback(() => {
    setActiveModule(null);
    setNavStack([]);
  }, []);

  const push = useCallback((entry: ModuleNavEntry) => {
    setNavStack((stack) => [...stack, entry]);
  }, []);

  const pop = useCallback(() => {
    setNavStack((stack) => stack.slice(0, -1));
  }, []);

  const value = useMemo<NucleusContextValue>(
    () => ({
      activeModule,
      navStack,
      openModule,
      openModuleAt,
      close,
      push,
      pop,
      canGoBack: navStack.length > 0,
    }),
    [activeModule, navStack, openModule, openModuleAt, close, push, pop]
  );

  return (
    <NucleusContext.Provider value={value}>{children}</NucleusContext.Provider>
  );
}

export function useNucleus(): NucleusContextValue {
  const ctx = useContext(NucleusContext);
  if (!ctx) {
    throw new Error("useNucleus must be used inside <NucleusProvider>");
  }
  return ctx;
}

/**
 * Convenience hook for modules to drive their own in-module navigation.
 * Returns push/pop scoped to the current module's nav stack and the
 * current top entry.
 */
export function useModuleNav() {
  const { navStack, push, pop } = useNucleus();
  const current = navStack[navStack.length - 1] ?? null;
  return { navStack, push, pop, current };
}
