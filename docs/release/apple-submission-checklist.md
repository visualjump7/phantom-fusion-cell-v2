# Apple App Store Submission Checklist

Use this list before every App Store submission (and once before the very first one). Each item is either an Apple guideline requirement or a hard-won "this is what gets apps rejected" item. The goal is a green submission on the first try without needing to disturb the live web build.

Reference: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## A. Apple Developer Account setup (one-time)

- [ ] Paid Apple Developer account active (not lapsed)
- [ ] Bundle identifier `com.phantomservices.fusioncell` registered
- [ ] App ID created with Push Notifications capability (even if disabled in v1)
- [ ] App Store Connect "App" record created with the same bundle ID
- [ ] Distribution certificate and provisioning profile generated
- [ ] TestFlight internal group created with at least 2 testers

## B. Marketing & metadata (App Store Connect)

- [ ] App name (≤ 30 chars): `Fusion Cell`
- [ ] Subtitle (≤ 30 chars): drafted
- [ ] Promotional text (≤ 170 chars): drafted
- [ ] Description (≤ 4000 chars): drafted, no marketing claims that imply guarantees
- [ ] Keywords (≤ 100 chars): drafted, comma-separated
- [ ] Support URL: live and reachable
- [ ] Marketing URL (optional): live or omitted
- [ ] Primary category and secondary category chosen
- [ ] Age rating questionnaire completed
- [ ] Copyright line: drafted

## C. Required URLs and pages (must be reachable in the production web app)

- [ ] **Privacy Policy** URL — Apple requires this before submission. Must explain data collected, third parties (Supabase, Mapbox), and the user's rights.
- [ ] **Terms of Service / EULA** URL (Apple's standard EULA may be reused)
- [ ] **Account deletion path** — Apple requires apps that allow account creation to provide an in-app account deletion path. Verify the in-app flow ends at a confirmation screen and that the underlying user record is actually deleted.
- [ ] **Support URL** — landing page with contact email or form, no auth wall
- [ ] **Test credentials** — provided in App Review Information (use a dedicated demo account, not a real client login)

## D. Privacy nutrition label (App Privacy)

Filled out in App Store Connect. Common entries for this app:

- [ ] Contact info (email) — used for App Functionality, linked to user
- [ ] User content (messages, files) — used for App Functionality, linked to user
- [ ] Identifiers (user ID) — used for App Functionality, linked to user
- [ ] Diagnostics (crash data) — used for App Functionality, not linked to user
- [ ] Confirm "data not used for tracking" if the app does no cross-app tracking

## E. App icons & launch screen

- [ ] App icon (1024×1024, no transparency, no rounded corners — Apple rounds it)
- [ ] All required iOS icon sizes generated and embedded in the Xcode asset catalog
- [ ] Launch screen storyboard or asset present (no static image-only launch screens for new apps)
- [ ] Status bar style configured for the launch screen background

## F. Screenshots

- [ ] 6.7" iPhone screenshots (Pro Max class) — at least 3, ideally 5
- [ ] 6.5" iPhone screenshots (legacy fallback) — at least 3
- [ ] iPad screenshots if the app supports iPad — otherwise restrict device family in Xcode
- [ ] No status bar artifacts, no draft watermarks, no copyrighted third-party logos

## G. WebView wrapper review traps (specific to this app's architecture)

The Capacitor remote-URL strategy means we must mitigate Apple's "thin web wrapper" rejection (Guideline 4.2):

- [ ] At least one **native** capability beyond the WebView before first submission (e.g. native splash + native share OR push notifications). The remote URL alone is insufficient.
- [ ] App does not present links that look like a browser tab bar
- [ ] All navigation outside `fusioncell.phantomservices.com` opens in Safari, not in the WebView (already enforced by `capacitor.config.json` `allowNavigation`)
- [ ] App does not show payment flows that bypass IAP (we do not, but verify before each submission)
- [ ] App stores no Apple-specific user data outside its sandbox
- [ ] App handles offline gracefully (the offline shell loads, then a connection error appears if remote URL is unreachable)

## H. Reviewer-facing notes (App Review Information)

Provide in App Store Connect for the reviewer:

- Test account credentials (dedicated demo account)
- Brief explanation that the app is the iOS client for an existing executive dashboard product
- Note that a privacy policy is published at the URL above
- Note that account deletion is available in Settings → Account

## I. Pre-submission gates

- [ ] `web-stable-vN` tag is fresh (web smoke checklist green)
- [ ] iOS smoke checklist (`docs/release/ios-smoke-checklist.md`) green on a physical device
- [ ] Build compiled with the production scheme, not Debug
- [ ] Build number incremented (must be strictly greater than all prior builds for this version)
- [ ] No `console.log` in production web code paths reached by iOS users (audit before tagging)
- [ ] Crash reporting enabled (Xcode Organizer should show symbols)

## J. Post-submission

- [ ] Phased rollout enabled (start at internal testers only)
- [ ] Monitor App Store Connect for review status daily
- [ ] If rejected: read the reason, do not argue first — resubmit with the fix
- [ ] After approval: tag `ios-vN.M.B` in git, update [`ios/README.md`](../../ios/README.md) release notes section if needed
