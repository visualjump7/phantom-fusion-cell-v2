# iOS Rollback Playbook

Use this when the iOS app (TestFlight or App Store) is broken but the web app is healthy. The goal is to recover iOS users without disturbing web.

## Decision criteria

Roll back iOS if:

- A new iOS build crashes on launch for >1% of sessions
- Auth/session is broken on iOS only
- A native integration (push, deep link, secure storage) is corrupting state

If the issue is shared (web is also broken), use `docs/release/web-rollback-playbook.md` first.

## Step 1 — Disable the offending feature remotely

The fastest recovery is a feature-flag flip, not a resubmission.

- Identify the flag controlling the broken surface in `lib/feature-flags.ts`
- Flip it off via the runtime config (env var or remote config row)
- Confirm next iOS app launch picks up the flag

This works because most new iOS-side surfaces are gated by `ios_enabled_*` flags by policy.

## Step 2 — Pull the build (if shipped via App Store)

- Open App Store Connect → My Apps → Pricing and Availability or Phased Release
- Pause phased rollout, or remove the build from sale if severe
- For TestFlight, expire the broken build for testers

## Step 3 — Submit a fix

- Branch from the last good `ios-vN.M.B` tag
- Apply the minimal fix
- Bump build number, regenerate IPA, submit via Xcode/Transporter
- Mark the App Store review as expedited if user impact is severe

## Step 4 — Verify

- Smoke test the new build on at least two physical devices (one current iOS, one one-major-version-back)
- Re-enable the feature flag once the rollout is healthy

## Step 5 — Post-incident

- Add a regression check to `docs/release/ios-smoke-checklist.md`
- If the bug was caused by a shared backend change, also update `docs/release/shared-change-policy.md`
