import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  isMissingThemePreferenceColumnError,
  isThemeColor,
  isThemeDensity,
  normalizeThemePreferences,
} from "@/lib/theme-preferences";

function mergeThemePreferencesIntoMetadata(
  metadata: unknown,
  incoming: { theme_color?: string; theme_density?: string }
) {
  const nextMetadata: Record<string, unknown> =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};

  const existingThemePrefs: Record<string, unknown> =
    nextMetadata.theme_preferences &&
    typeof nextMetadata.theme_preferences === "object" &&
    !Array.isArray(nextMetadata.theme_preferences)
      ? { ...(nextMetadata.theme_preferences as Record<string, unknown>) }
      : {};

  if (incoming.theme_color) {
    existingThemePrefs.theme_color = incoming.theme_color;
  }

  if (incoming.theme_density) {
    existingThemePrefs.theme_density = incoming.theme_density;
  }

  nextMetadata.theme_preferences = existingThemePrefs;
  return nextMetadata;
}

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      const fallbackPrefs = normalizeThemePreferences({ metadata: fallbackData?.metadata });
      return NextResponse.json({
        theme_color: fallbackPrefs.theme,
        theme_density: fallbackPrefs.density,
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prefs = normalizeThemePreferences(data || {});
  return NextResponse.json({
    theme_color: prefs.theme,
    theme_density: prefs.density,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (isThemeColor(body?.theme_color)) {
    updates.theme_color = body.theme_color;
  }

  if (isThemeDensity(body?.theme_density)) {
    updates.theme_density = body.theme_density;
  }

  if (!updates.theme_color && !updates.theme_density) {
    return NextResponse.json(
      { error: "Provide at least one valid preference field." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("theme_color, theme_density, metadata")
    .maybeSingle();

  if (error) {
    if (isMissingThemePreferenceColumnError(error.message)) {
      const { data: existingProfile, error: readError } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", user.id)
        .maybeSingle();

      if (readError) {
        return NextResponse.json({ error: readError.message }, { status: 500 });
      }

      const mergedMetadata = mergeThemePreferencesIntoMetadata(existingProfile?.metadata, {
        theme_color: updates.theme_color,
        theme_density: updates.theme_density,
      });

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .update({
          metadata: mergedMetadata,
          updated_at: updates.updated_at,
        })
        .eq("id", user.id)
        .select("metadata")
        .maybeSingle();

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      const fallbackPrefs = normalizeThemePreferences({
        metadata: fallbackData?.metadata ?? mergedMetadata,
      });

      return NextResponse.json({
        theme_color: fallbackPrefs.theme,
        theme_density: fallbackPrefs.density,
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prefs = normalizeThemePreferences(data || updates);

  return NextResponse.json({
    theme_color: prefs.theme,
    theme_density: prefs.density,
  });
}
