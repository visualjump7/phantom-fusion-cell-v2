"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  ThemeColor,
  ThemeDensity,
  ThemePreferences,
} from "@/lib/theme-preferences";

interface ThemeContextValue extends ThemePreferences {
  setTheme: (theme: ThemeColor) => void;
  setDensity: (density: ThemeDensity) => void;
  setPreferences: (prefs: ThemePreferences) => void;
  toggleTheme: () => void;
}

const COMFORT_FONT_LINK_ID = "comfort-font-link";
const COMFORT_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&family=Atkinson+Hyperlegible+Mono:wght@400;500;600;700&display=swap";

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  density: DEFAULT_DENSITY,
  setTheme: () => {},
  setDensity: () => {},
  setPreferences: () => {},
  toggleTheme: () => {},
});

function applyRootAttributes(theme: ThemeColor, density: ThemeDensity) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-density", density);
}

function maybeLoadComfortFont(density: ThemeDensity) {
  const existing = document.getElementById(COMFORT_FONT_LINK_ID);
  if (density !== "comfort") {
    existing?.remove();
    return;
  }

  if (existing) return;

  const link = document.createElement("link");
  link.id = COMFORT_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = COMFORT_FONT_STYLESHEET;
  document.head.appendChild(link);
}

export function useThemePreferences() {
  return useContext(ThemeContext);
}

export function useTheme() {
  return useThemePreferences();
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeColor;
  initialDensity?: ThemeDensity;
}

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
  initialDensity = DEFAULT_DENSITY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeColor>(initialTheme);
  const [density, setDensityState] = useState<ThemeDensity>(initialDensity);
  const didMountRef = useRef(false);

  const persistPreferences = useCallback(async (nextTheme: ThemeColor, nextDensity: ThemeDensity) => {
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme_color: nextTheme,
          theme_density: nextDensity,
        }),
      });
    } catch (error) {
      console.warn("Unable to persist theme preferences:", error);
    }
  }, []);

  useEffect(() => {
    applyRootAttributes(theme, density);
    maybeLoadComfortFont(density);
  }, [theme, density]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void persistPreferences(theme, density);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [theme, density, persistPreferences]);

  const setTheme = useCallback(
    (nextTheme: ThemeColor) => {
      setThemeState(nextTheme);
    },
    []
  );

  const setDensity = useCallback(
    (nextDensity: ThemeDensity) => {
      setDensityState(nextDensity);
    },
    []
  );

  const setPreferences = useCallback(
    (prefs: ThemePreferences) => {
      setThemeState(prefs.theme);
      setDensityState(prefs.density);
    },
    []
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeColor =
      theme === "dark" ? "light" : theme === "light" ? "hybrid" : "dark";
    setTheme(nextTheme);
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, density, setTheme, setDensity, setPreferences, toggleTheme }),
    [theme, density, setTheme, setDensity, setPreferences, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
