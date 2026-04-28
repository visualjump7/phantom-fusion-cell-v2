# iOS App (Capacitor wrapper)

This directory holds the iOS native shell that wraps the existing Next.js web app. It is intentionally empty until you run the bootstrap step below — keeping the source tree out of `main` until a real iOS build is in motion ensures the web app never changes because of iOS work.

## Architecture summary

- The iOS app is a thin Capacitor WebView shell.
- It points at the production web URL (`https://fusioncell.phantomservices.com`) and loads it remotely.
- Supabase auth, middleware, redirects, and SSR all run on the web server. The native shell adds:
  - App Store distribution
  - Native splash + status bar treatment
  - Future native integrations (push, deep links, secure storage) gated by feature flags in `lib/feature-flags.ts`

This is the lowest-risk way to ship to Apple without touching the production web build.

## One-time bootstrap

Run the following on a `release/ios-bootstrap` branch (never on `main`):

```bash
# 1. Install Capacitor at the runtime + dev-tool layers
npm install --save @capacitor/core @capacitor/ios
npm install --save-dev @capacitor/cli

# 2. Initialize the native iOS Xcode project from capacitor.config.ts
npx cap add ios

# 3. Sync the offline shell (required even though we load remotely)
npx cap sync ios

# 4. Open the generated Xcode workspace
npx cap open ios
```

After bootstrap, commit the generated `ios/App/` Xcode project, but the `.gitignore` already excludes build outputs (`Pods/`, `build/`, `xcuserdata/`).

## Day-to-day

- Edit web code as usual — most iOS changes require zero native work because the wrapper just loads the remote URL.
- After changing `capacitor.config.ts` or the offline shell: `npx cap sync ios`.
- After updating the Xcode project: open `ios/App/App.xcworkspace` in Xcode and build to a device or simulator.

## Pointing at staging

```bash
CAPACITOR_SERVER_URL=https://staging.fusioncell.phantomservices.com npx cap sync ios
```

The app will load that URL until the next sync.

## Releasing to TestFlight

1. Verify `web-stable-vN` is the current production web tag.
2. Run `docs/release/ios-smoke-checklist.md` against the latest internal build.
3. Bump build number in Xcode (Targets → App → General → Identity).
4. Archive (Product → Archive) and upload to App Store Connect.
5. Tag the release: `git tag -a ios-v0.1.<build> -m "TestFlight build <n>"` and push the tag.

See also:

- [`docs/release/branch-and-release-policy.md`](../docs/release/branch-and-release-policy.md)
- [`docs/release/ios-smoke-checklist.md`](../docs/release/ios-smoke-checklist.md)
- [`docs/release/ios-rollback.md`](../docs/release/ios-rollback.md)
- [`docs/release/apple-submission-checklist.md`](../docs/release/apple-submission-checklist.md)
