/**
 * Platform detection — single source of truth for "where is this code running?"
 *
 * Why this exists:
 *   - The Next.js codebase is shared between the production web app and an
 *     iOS native shell (Capacitor wrapper). Most of the time you don't care,
 *     but a small number of branches need to behave differently:
 *       - native-only integrations (push, deep links, secure storage)
 *       - WebView quirks (safe-area insets, keyboard, scroll behavior)
 *       - feature flag rollout that should differ per platform
 *
 * Design rules:
 *   - Server components see Platform.web. The native shell only renders the
 *     client bundle, so server-rendered output should be identical for both.
 *   - Detection is conservative: if we can't prove we're inside the native
 *     wrapper, we assume web. This keeps the existing web build untouched.
 *   - Never throw from this module. Returning a sane default is more
 *     important than being right in edge cases.
 */

export type Platform = "web" | "ios";

/**
 * Returns the platform the current code is executing on.
 *
 * Detection order:
 *   1. Server-side render → "web" (no native context available)
 *   2. Capacitor global injected by the native shell → "ios"
 *   3. Fallback → "web"
 */
export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";

  const capacitor = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } })
    .Capacitor;

  if (capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === "ios") {
    return "ios";
  }

  return "web";
}

export function isIOSNative(): boolean {
  return getPlatform() === "ios";
}

export function isWeb(): boolean {
  return getPlatform() === "web";
}
