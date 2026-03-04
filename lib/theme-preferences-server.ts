import { createServerSupabase } from "@/lib/supabase-server";
import {
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  isMissingThemePreferenceColumnError,
  ThemePreferences,
  normalizeThemePreferences,
} from "@/lib/theme-preferences";

export async function getServerThemePreferences(): Promise<ThemePreferences> {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { theme: DEFAULT_THEME, density: DEFAULT_DENSITY };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("theme_color, theme_density, metadata")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      if (isMissingThemePreferenceColumnError(error.message)) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("metadata")
          .eq("id", user.id)
          .maybeSingle();

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
