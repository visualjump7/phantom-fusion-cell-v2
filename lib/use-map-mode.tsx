"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useThemePreferences } from "@/components/ThemeProvider";
import {
  getMapDefaultForAppTheme,
  type MapProjectionKey,
  type MapStyleKey,
} from "@/components/map/GlobeMap";

interface MapMode {
  projection: MapProjectionKey;
  style: MapStyleKey;
}

interface MapModeContextValue extends MapMode {
  setMapMode: (mode: MapMode) => void;
  setMapStyle: (style: MapStyleKey) => void;
  setMapProjection: (projection: MapProjectionKey) => void;
}

const STORAGE_KEY = "fusioncell-map-mode";

function isValidMode(value: unknown): value is MapMode {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const projOk = v.projection === "3D" || v.projection === "2D";
  const styleOk =
    v.style === "dark" || v.style === "light" || v.style === "satellite";
  if (!projOk || !styleOk) return false;
  // Reject invalid pairings — satellite only in 3D, light only in 2D.
  if (v.projection === "3D" && v.style === "light") return false;
  if (v.projection === "2D" && v.style === "satellite") return false;
  return true;
}

function readStored(): MapMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidMode(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(mode: MapMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function clearStored() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Reconcile a new (projection, style) pair so the pairing is always valid. */
function reconcile(mode: MapMode): MapMode {
  if (mode.projection === "3D" && mode.style === "light") {
    return { projection: "3D", style: "dark" };
  }
  if (mode.projection === "2D" && mode.style === "satellite") {
    return { projection: "2D", style: "dark" };
  }
  return mode;
}

const MapModeContext = createContext<MapModeContextValue | null>(null);

/**
 * Provides the user's last-selected map mode (projection + style), shared
 * between the Standard View and Immersive View maps.
 *
 * Load priority:
 *   1. localStorage ("fusioncell-map-mode") if a valid value exists
 *   2. App theme default (light → 2D Light, anything else → 3D Dark)
 *
 * When the app theme changes, the stored value is cleared and both views
 * reset to the new theme default until the user picks again.
 */
export function MapModeProvider({ children }: { children: ReactNode }) {
  const { theme: appTheme } = useThemePreferences();

  const [mode, setModeState] = useState<MapMode>(() => {
    const stored = readStored();
    if (stored) return stored;
    return getMapDefaultForAppTheme(appTheme);
  });

  // Track the previous app theme so we only reset on an actual change,
  // not on the initial mount (which would wipe a valid stored selection).
  const prevThemeRef = useRef(appTheme);
  useEffect(() => {
    if (prevThemeRef.current !== appTheme) {
      prevThemeRef.current = appTheme;
      clearStored();
      setModeState(getMapDefaultForAppTheme(appTheme));
    }
  }, [appTheme]);

  const setMapMode = useCallback((next: MapMode) => {
    const reconciled = reconcile(next);
    setModeState(reconciled);
    writeStored(reconciled);
  }, []);

  const setMapStyle = useCallback((style: MapStyleKey) => {
    setModeState((prev) => {
      const next = reconcile({ projection: prev.projection, style });
      writeStored(next);
      return next;
    });
  }, []);

  const setMapProjection = useCallback((projection: MapProjectionKey) => {
    setModeState((prev) => {
      const next = reconcile({ projection, style: prev.style });
      writeStored(next);
      return next;
    });
  }, []);

  const value = useMemo<MapModeContextValue>(
    () => ({
      projection: mode.projection,
      style: mode.style,
      setMapMode,
      setMapStyle,
      setMapProjection,
    }),
    [mode, setMapMode, setMapStyle, setMapProjection]
  );

  return (
    <MapModeContext.Provider value={value}>{children}</MapModeContext.Provider>
  );
}

export function useMapMode(): MapModeContextValue {
  const ctx = useContext(MapModeContext);
  if (!ctx) {
    throw new Error("useMapMode must be used inside <MapModeProvider>");
  }
  return ctx;
}
