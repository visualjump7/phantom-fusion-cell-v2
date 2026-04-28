/**
 * Feature flags — platform-aware, env-driven, fail-safe.
 *
 * Why this exists:
 *   The web app and the iOS shell share a codebase. We need to ship code to
 *   both clients without coupling their rollout timing. Every risky surface
 *   (new comms behavior, native-only integrations, App Store-gated features)
 *   goes behind a flag here.
 *
 * Resolution order for each flag:
 *   1. Explicit env override (`NEXT_PUBLIC_FF_<name>` = "true" | "false")
 *   2. Per-platform default in the flag definition
 *   3. `false` (the safest answer)
 *
 * Anti-goals:
 *   - This is not a remote-config service. It's intentionally simple: env +
 *     compile-time defaults. When we add Supabase- or LaunchDarkly-style
 *     remote config later, the resolver function below is the only place
 *     that needs to change — call sites stay identical.
 */

import { getPlatform, type Platform } from "./platform";

type FlagDefinition = {
  /** Per-platform default. Missing entries default to `false`. */
  defaults: Partial<Record<Platform, boolean>>;
  /** Human-readable description shown in audits / future admin UI. */
  description: string;
};

/**
 * Registry of every feature flag in the app.
 *
 * Naming convention:
 *   - lower_snake_case
 *   - prefix with the surface it guards (`comms_`, `ios_`, `web_`)
 *   - suffix `_enabled` for boolean toggles
 */
const FLAGS = {
  /**
   * Whether the iOS native shell is allowed to expose the new chat surface.
   * Lets us ship the chat code to the App Store binary while keeping it dark
   * for users until backend RLS / push wiring is verified.
   */
  comms_chat_enabled: {
    defaults: { web: true, ios: false },
    description: "Show the Comms → Chat tab.",
  },

  /**
   * Native push notification handling. Requires the iOS app to have
   * registered for APNs and the backend to be wired to send.
   */
  ios_push_enabled: {
    defaults: { web: false, ios: false },
    description: "Enable APNs push registration and routing on iOS.",
  },

  /**
   * Universal Links / custom-scheme deep links inside the native shell.
   * Off until App Site Association is published and tested.
   */
  ios_deep_links_enabled: {
    defaults: { web: false, ios: false },
    description: "Honor universal links and custom-scheme deep links on iOS.",
  },

  /**
   * Use the iOS Keychain (via Capacitor secure storage) instead of
   * cookie-only sessions. Off until the auth bridge is implemented.
   */
  ios_secure_session_enabled: {
    defaults: { web: false, ios: false },
    description: "Persist Supabase session tokens in iOS Keychain.",
  },

  /**
   * Treat the current build as a web-only release. When true, any iOS-only
   * surface that somehow renders on web (defensively) becomes a no-op.
   * This is mostly a guardrail flag for emergency use.
   */
  web_only_lockdown: {
    defaults: { web: false, ios: false },
    description:
      "Emergency: hide all iOS-only surfaces even if the platform check misfires.",
  },
} as const satisfies Record<string, FlagDefinition>;

export type FeatureFlag = keyof typeof FLAGS;

/**
 * Read a flag for the current runtime platform.
 *
 * Server components and the web bundle both resolve to the "web" platform.
 * Native-only branches must guard with both `isFeatureEnabled` and the
 * platform check from `lib/platform.ts` when they need to avoid running on
 * the server.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const platform = getPlatform();
  return resolveFlag(flag, platform);
}

/**
 * Read a flag for a specific platform. Useful in admin UIs that audit flag
 * state across platforms.
 */
export function isFeatureEnabledFor(flag: FeatureFlag, platform: Platform): boolean {
  return resolveFlag(flag, platform);
}

function resolveFlag(flag: FeatureFlag, platform: Platform): boolean {
  const override = readEnvOverride(flag);
  if (override !== null) return override;

  const def = FLAGS[flag];
  return def.defaults[platform] ?? false;
}

function readEnvOverride(flag: FeatureFlag): boolean | null {
  const envKey = `NEXT_PUBLIC_FF_${flag.toUpperCase()}`;
  // Bracket access keeps Next.js from inlining the entire env into the
  // bundle. Only the keys we explicitly read get inlined.
  const value = process.env[envKey];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * Returns the full registry — used by audit/admin tooling. Not for runtime
 * gating (use `isFeatureEnabled` instead).
 */
export function listFeatureFlags(): Array<{
  flag: FeatureFlag;
  description: string;
  webDefault: boolean;
  iosDefault: boolean;
  webResolved: boolean;
  iosResolved: boolean;
}> {
  return (Object.keys(FLAGS) as FeatureFlag[]).map((flag) => {
    const def = FLAGS[flag];
    return {
      flag,
      description: def.description,
      webDefault: def.defaults.web ?? false,
      iosDefault: def.defaults.ios ?? false,
      webResolved: resolveFlag(flag, "web"),
      iosResolved: resolveFlag(flag, "ios"),
    };
  });
}
