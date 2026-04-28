# Web Smoke Checklist

Run this checklist after every production web deploy and before tagging a new `web-stable-vN` baseline. The goal is fast confidence that the existing web product still works while iOS work is happening in parallel.

Target environment: **production web** (the URL backed by `main`).

## 0. Preflight

- Branch deployed: `main`
- Last deploy SHA matches the latest commit on `origin/main`
- `web-stable-vN` tag exists on the previous good build (rollback target)

## 1. Auth and session

- Logged-out user hitting `/` is redirected to `/login`
- Email/password login with the documented test account succeeds
- After login, executive role lands on `/command`
- After login, staff role lands on `/command` (or `/dashboard` if `profiles.default_landing = 'dashboard'`)
- Sign out returns to `/login` and session is cleared

## 2. Core navigation

- Navbar links resolve without hard reloads
- Bottom nav (mobile) renders and routes correctly
- Theme toggle (light/dark) does not throw console errors
- Search bar opens and closes

## 3. Dashboard

- Dashboard renders without runtime errors
- Cash flow card loads
- Travel/map module loads (Mapbox tiles render)
- Daily brief preview renders if a brief exists

## 4. Comms (alerts + chat)

- `/comms` redirects to `/comms/chat`
- Legacy `/messages` redirects to `/comms/alerts` (verify HTTP 308 in network tab)
- Legacy `/chat` redirects to `/comms/chat`
- Alerts list loads
- Chat thread list loads
- Sending a message inserts a row and renders the new bubble without reload
- Receiving a message in another session renders without reload (Realtime works)

## 5. Admin (if account has staff/admin role)

- `/admin` overview renders client cards
- `/admin/client/[orgId]` workspace loads
- `/admin/client/[orgId]/comms/chat` and `/comms/alerts` load
- Legacy `/admin/client/[orgId]/messages` redirects to `/comms/alerts`
- Upload flow on `/admin/client/[orgId]/upload` reaches the file picker

## 6. Errors and observability

- No new error spikes in browser console on the routes above
- Server logs show no new 5xx clusters tied to the deploy
- Supabase RLS errors not surfacing in normal flows

## 7. Sign-off

- [ ] Smoke run by: ____________
- [ ] Date/time: ____________
- [ ] Git SHA: ____________
- [ ] Result: pass / fail (if fail → execute `docs/release/web-rollback-playbook.md`)
