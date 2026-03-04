export type ThemeColor = "dark" | "light";
export type ThemeDensity = "compact" | "comfort";

export interface ThemePreferences {
  theme: ThemeColor;
  density: ThemeDensity;
}

type ThemePreferencesInput = {
  theme_color?: unknown;
  theme_density?: unknown;
  metadata?: unknown;
};

export const DEFAULT_THEME: ThemeColor = "dark";
export const DEFAULT_DENSITY: ThemeDensity = "compact";

export function isThemeColor(value: unknown): value is ThemeColor {
  return value === "dark" || value === "light";
}

export function isThemeDensity(value: unknown): value is ThemeDensity {
  return value === "compact" || value === "comfort";
}

function getThemePrefsFromMetadata(metadata: unknown): {
  theme_color?: unknown;
  theme_density?: unknown;
} {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const themePrefs = (metadata as Record<string, unknown>).theme_preferences;
  if (!themePrefs || typeof themePrefs !== "object") {
    return {};
  }

  const record = themePrefs as Record<string, unknown>;
  return {
    theme_color: record.theme_color,
    theme_density: record.theme_density,
  };
}

export function isMissingThemePreferenceColumnError(message?: string | null): boolean {
  const normalized = (message ?? "").toLowerCase();
  const mentionsThemeColumns =
    normalized.includes("theme_color") || normalized.includes("theme_density");
  const looksLikeMissingColumn =
    normalized.includes("does not exist") || normalized.includes("schema cache");

  return mentionsThemeColumns && looksLikeMissingColumn;
}

export function normalizeThemePreferences(input?: ThemePreferencesInput): ThemePreferences {
  const metadataPrefs = getThemePrefsFromMetadata(input?.metadata);
  const themeCandidate = isThemeColor(input?.theme_color)
    ? input?.theme_color
    : metadataPrefs.theme_color;
  const densityCandidate = isThemeDensity(input?.theme_density)
    ? input?.theme_density
    : metadataPrefs.theme_density;

  return {
    theme: isThemeColor(themeCandidate) ? themeCandidate : DEFAULT_THEME,
    density: isThemeDensity(densityCandidate) ? densityCandidate : DEFAULT_DENSITY,
  };
}
