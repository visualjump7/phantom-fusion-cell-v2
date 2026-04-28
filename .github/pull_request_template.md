## Summary
- Describe the code change in 1-3 bullets.

## Source task
- Closes #
- Link to issue:

## Platform target
- [ ] `target:web` — affects only the web app
- [ ] `target:ios` — affects only the iOS native shell
- [ ] `target:web,ios` — shared change (backend, lib/, components/, app/ outside platform-gated branches)

## Validation
- [ ] `npm run lint`
- [ ] `npm run check:migrations` (only if `sql/` changed)
- [ ] Manual verification completed (if UI/behavior changed)
- [ ] Screenshots/video attached (if UI changed)

## Shared-change checklist (only fill if `target:web,ios`)
See [`docs/release/shared-change-policy.md`](../docs/release/shared-change-policy.md).
- [ ] No `DROP COLUMN`, `DROP TABLE`, or `ALTER COLUMN ... TYPE` without dual-write notes
- [ ] New columns are nullable or have a default
- [ ] RLS changes do not reduce access for any current client version
- [ ] Migration file documents the rollback strategy

## Notes for reviewers
- Risks / tradeoffs:
- Follow-up tasks (optional):
