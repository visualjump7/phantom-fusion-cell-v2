# Shared Change Policy (Backend, API, DB)

Once iOS is in TestFlight or the App Store, the web and iOS clients may run different code at the same time. Any change to shared backend surface area (Supabase tables, RLS, server actions, REST/RPC routes) must be **backward-compatible across both clients**.

## Core rules

1. **No destructive migrations on a single deploy.**
   - Adding columns: OK if nullable or with a default.
   - Renaming columns: must use a dual-write window — add new column, dual-write from app, backfill, then drop the old column in a later release after both web and iOS have shipped the new client.
   - Dropping columns/tables: only after at least one full release cycle on both web **and** iOS confirms nothing reads them.

2. **No breaking RLS changes without a flag.**
   - New policies must allow existing client behavior until the new client is rolled out.
   - When tightening policies, ship the looser policy alongside the new column/flag, then tighten only after the older client is sunset.

3. **API responses are additive.**
   - You can add fields. You cannot remove or rename fields without a deprecation window.
   - When in doubt, add a new endpoint or version (`/v2`) and migrate clients explicitly.

## Migration template

Every SQL file in `sql/` that changes shared schema should include:

```sql
-- Migration: <short description>
-- Compatibility:
--   web client min version: <commit SHA or web-stable tag>
--   ios client min version: <build number or "n/a">
-- Rollback strategy: <how to undo without data loss>
```

## Pre-merge checklist (shared change PRs)

- [ ] Web smoke checklist passes against a preview deploy with the new schema
- [ ] iOS TestFlight build (if iOS is live) still works against the new schema
- [ ] No `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN ... TYPE` without dual-write notes
- [ ] RLS changes reviewed for cross-tenant exposure
- [ ] Rollback strategy documented in the migration file

## When iOS is not yet shipped

While iOS is still pre-TestFlight, web is the only active client and standard migrations are fine. Treat this policy as **mandatory once the first iOS internal TestFlight build is uploaded**, and add a banner to the PR description noting that.
