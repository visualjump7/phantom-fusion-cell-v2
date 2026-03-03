import { createServerSupabase } from "@/lib/supabase-server";
import { appendFileSync } from "fs";
import {
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  isMissingThemePreferenceColumnError,
  ThemePreferences,
  normalizeThemePreferences,
} from "@/lib/theme-preferences";

function debugLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
}) {
  try {
    appendFileSync("/opt/cursor/logs/debug.log", `${JSON.stringify(payload)}\n`);
  } catch {
    // Intentionally ignore logging failures in debug mode.
  }
}

export async function getServerThemePreferences(): Promise<ThemePreferences> {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // #region agent log
    debugLog({
      hypothesisId: "H3",
      location: "lib/theme-preferences-server.ts:getServerThemePreferences",
      message: "Server-side auth status for theme preference fetch",
      data: {
        hasUser: Boolean(user),
        userError: userError?.message ?? null,
      },
      timestamp: Date.now(),
    });
    // #endregion

    if (userError || !user) {
      return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("theme_color, theme_density, metadata")
      .eq("id", user.id)
      .maybeSingle();

    // #region agent log
    debugLog({
      hypothesisId: "H3",
      location: "lib/theme-preferences-server.ts:getServerThemePreferences",
      message: "Server-side profile preferences query result",
      data: {
        queryError: error?.message ?? null,
        theme_color: data?.theme_color ?? null,
        theme_density: data?.theme_density ?? null,
      },
      timestamp: Date.now(),
    });
    // #endregion

    if (error) {
      if (isMissingThemePreferenceColumnError(error.message)) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("metadata")
          .eq("id", user.id)
          .maybeSingle();

        // #region agent log
        debugLog({
          hypothesisId: "H3",
          location: "lib/theme-preferences-server.ts:getServerThemePreferences",
          message: "Fallback metadata query for theme preferences",
          data: {
            fallbackQueryError: fallbackError?.message ?? null,
            hasThemePrefsInMetadata: Boolean(
              fallbackData?.metadata &&
                typeof fallbackData.metadata === "object" &&
                "theme_preferences" in fallbackData.metadata
            ),
          },
          timestamp: Date.now(),
        });
        // #endregion

        if (fallbackError) {
          return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY };
        }

        return normalizeThemePreferences({ metadata: fallbackData?.metadata });
      }

      return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY };
    }

    return normalizeThemePreferences(data || {});
  } catch {
    return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY };
  }
}
