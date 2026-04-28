# Release Documentation

This directory is the source of truth for how the Fusion Cell product ships to web and iOS without either platform disrupting the other.

Read in this order before your first release of either platform:

1. [`branch-and-release-policy.md`](branch-and-release-policy.md) — branches, tags, and lanes
2. [`shared-change-policy.md`](shared-change-policy.md) — what makes a backend change "shared-safe"
3. [`web-smoke-checklist.md`](web-smoke-checklist.md) — what to verify after every web deploy
4. [`web-rollback-playbook.md`](web-rollback-playbook.md) — how to recover the web app
5. [`ios-architecture.md`](ios-architecture.md) — why we use a Capacitor wrapper and not a rewrite
6. [`ios-smoke-checklist.md`](ios-smoke-checklist.md) — what to verify on every TestFlight build
7. [`ios-rollback.md`](ios-rollback.md) — how to recover the iOS app without disturbing web
8. [`apple-submission-checklist.md`](apple-submission-checklist.md) — App Store readiness gate

Operational pointers:

- Web baseline tag: `web-stable-v1` (move to `v2` after the next clean release)
- iOS bootstrap: see [`/ios/README.md`](../../ios/README.md)
- Feature flags: [`/lib/feature-flags.ts`](../../lib/feature-flags.ts) — single registry for platform-aware rollout
