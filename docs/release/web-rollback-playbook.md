# Web Rollback Playbook

Use this playbook when the production web app is broken and the safest action is to revert to the last known-good baseline. Designed to take < 5 minutes from decision to recovery.

## Decision criteria

Roll back if any of the following are true after a deploy:

- Auth, login, or session is broken for any role
- Comms (alerts or chat) sends/reads stop working
- Dashboard or core admin routes throw runtime errors for >1% of users
- Supabase RLS regression exposes data across organizations
- Mobile (Safari/Chrome) UI is unusable on iPhone-sized viewports

If the issue is only on iOS (native app), do **not** roll back the web — see `docs/release/ios-rollback.md` instead.

## Step 1 — Identify the safe baseline

The latest baseline is always tagged `web-stable-vN`. Find the most recent one:

```bash
git fetch --tags
git tag --list 'web-stable-v*' --sort=-creatordate | head -5
```

Pick the most recent tag (or one before that if the most recent is suspect).

## Step 2 — Roll back via the deploy provider

Preferred path (no git changes):

- Open the production deploy provider (Vercel or equivalent)
- Promote the deployment that corresponds to the chosen `web-stable-vN` tag back to production
- Confirm the production URL serves the old build

This is reversible and does not rewrite any branches.

## Step 3 — Code-level rollback (only if provider rollback is unavailable)

```bash
git checkout main
git pull --ff-only origin main

# Create a fresh branch off main and reset to the safe tag
git checkout -b hotfix/web-rollback-$(date +%Y%m%d-%H%M)
git reset --hard web-stable-vN

# Push as a new branch and open a PR titled "Rollback web to web-stable-vN"
git push -u origin HEAD
```

Never `git push --force` to `main`. Always go through a PR even for rollbacks so the audit trail is intact.

## Step 4 — Verify

- Run `docs/release/web-smoke-checklist.md` against the rolled-back deploy
- Confirm Supabase Realtime still flows for chat
- Notify stakeholders that the web app is back on `web-stable-vN`

## Step 5 — Post-rollback

- Open an incident note describing the failure mode and the offending SHA
- Add a regression check to the smoke checklist if the failure was not caught earlier
- Plan the fix on a feature branch (do **not** push fix-forward commits directly to `main`)
