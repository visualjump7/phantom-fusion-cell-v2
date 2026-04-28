# Branch and Release Policy (Web + iOS)

This policy keeps the production web app continuously releasable while iOS work happens in parallel. Read this before opening any branch that touches shared code (`app/`, `components/`, `lib/`, `sql/`).

## Branches

- `main`
  - Always web-production-ready
  - All changes land via PR
  - CI must be green (lint + build) before merge
  - Tagged `web-stable-vN` after every successful production smoke test
- `feature/*`
  - Web feature work
  - Must rebase or merge `main` before opening PR
  - Required label: `target:web` (or `target:web,ios` for shared)
- `release/ios-*`
  - iOS packaging, native shells, App Store assets
  - Branches off `main`
  - May merge back to `main` only via PR with `target:ios` label
- `cursor/*`, `experiment/*`
  - Short-lived exploration; never merged to `main` without rebasing onto `main` first

## Release lanes

| Lane | Source | Target | Cadence | Rollback |
|------|--------|--------|---------|----------|
| Web prod | `main` | production web URL | continuous | redeploy `web-stable-vN` |
| Web preview | feature branches | preview URLs | per push | n/a |
| iOS internal (TestFlight) | `release/ios-*` | TestFlight internal group | per build | disable feature flag, then submit fix |
| iOS external (TestFlight) | `release/ios-*` | TestFlight external group | weekly | same as above |
| App Store | `release/ios-*` (signed) | App Store | scheduled | expedited fix + flag disable |

## Tagging policy

- `web-stable-vN` — last known-good production web build
- `ios-vN.M.B` — App Store submission build, where `N.M` is marketing version and `B` is build number

Tags are immutable. Never re-point a tag.

## PR requirements

Every PR must declare its target platform via labels:

- `target:web` — web only
- `target:ios` — iOS only
- `target:web,ios` — shared change (most risky)

Shared-change PRs additionally require:

- A note in the PR body explaining backward-compatibility for both clients
- No destructive DB migrations (see `docs/release/shared-change-policy.md`)
- Smoke verification on web before merge

## Hotfix flow

1. Branch off the most recent `web-stable-vN` tag (not `main`) if `main` already has unrelated risky changes.
2. Apply the minimal fix.
3. Open PR titled `hotfix(web): <summary>` with `target:web` label.
4. After merge, redeploy and re-tag `web-stable-vN+1`.

## What never to do

- Never force-push `main`
- Never bundle web and iOS-only changes in a single commit
- Never run destructive SQL migrations without the dual-write window described in `docs/release/shared-change-policy.md`
- Never block web releases on iOS readiness
