# iOS Smoke Checklist

Run after every TestFlight build and before promoting a build to App Store. Tests the wrapped Next.js app inside the native iOS shell.

Target environment: latest TestFlight build on a physical iPhone running the current public iOS version.

## 0. Preflight

- Build number is greater than the last installed build
- App icon and launch screen render correctly
- App Store Connect lists the build as "Ready to Test" (TestFlight) or in expected review state

## 1. Cold start

- App launches without crashing
- Splash/launch screen transitions to the WebView shell
- Initial route loads without a blank white screen

## 2. Auth

- Login screen renders inside the native shell
- Email/password login succeeds against production Supabase
- Session persists after backgrounding the app for 1+ minute
- Force-quit and relaunch keeps the user logged in
- Sign out clears native session storage and lands on login

## 3. Core flows (must mirror web)

- Dashboard loads
- Comms → Chat thread list loads
- Sending a chat message works
- Comms → Alerts loads
- Admin (if applicable role) loads workspace

## 4. Native integrations (gated by flags)

- Status bar style and safe areas correct on notch + Dynamic Island devices
- Pull-to-refresh works inside scrollable surfaces
- Back gesture / swipe behaves predictably
- Keyboard does not cover the message composer in chat
- Deep links open the right route (only if `ios_deep_links` flag is enabled)
- Push notifications received and tapped land on correct route (only if `ios_push` flag is enabled)

## 5. Performance

- App size under target threshold (note size in MB)
- No noticeable jank on chat scrolling
- Memory usage stays under 250 MB during normal flows

## 6. Sign-off

- [ ] Tester: ____________
- [ ] Device + iOS version: ____________
- [ ] Build number: ____________
- [ ] Result: pass / fail (if fail → `docs/release/ios-rollback.md`)
