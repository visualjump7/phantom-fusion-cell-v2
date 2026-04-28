# iOS App Architecture (ADR)

## Decision

Ship the iOS app as a **remote-URL Capacitor wrapper** around the existing Next.js web app, not as a native rewrite or a static-exported bundled app.

## Context

- The web app uses Next.js 14 App Router, server components, server-side Supabase cookie auth, and middleware on every request.
- A static export (`next export`) would require removing or rewriting all server components and middleware, which would destabilize the live web product.
- The product is already network-dependent (Supabase + Mapbox + Realtime), so an offline-capable native rewrite has no near-term ROI.

## Decision

The iOS app loads `https://fusioncell.phantomservices.com` inside a Capacitor WebView. The web server stays the single source of truth. Capacitor adds:

- App Store distribution
- Native splash and status bar
- Hooks for future native integrations (push, deep links, Keychain), all gated behind feature flags in [`lib/feature-flags.ts`](../../lib/feature-flags.ts)

## Consequences

Pros:

- Zero changes to the existing web build
- One codebase, one deploy pipeline drives both clients
- Web fixes ship to iOS users on the next page load
- Lowest possible disruption risk to the production web product

Cons:

- App requires network connectivity (acceptable for v1)
- Apple Review may flag a "thin web wrapper" — mitigated by adding native splash, status bar, and at least one native capability (push or deep links) before submission

## Alternatives considered

1. **Static export + bundled web** — rejected: forces removing server components and middleware, breaks Supabase SSR session handling, high risk to web stability.
2. **React Native rewrite** — rejected: 3-6 months of work, separate codebase, no near-term gain.
3. **PWA on iOS Safari** — rejected: lacks App Store distribution, push, and reliable session persistence in standalone mode.

## Reversibility

If we later choose a native rewrite, the Capacitor shell can be retired without changing the web app. All native-only behavior is gated behind `ios_*` flags, so feature parity stays intact during any transition.
