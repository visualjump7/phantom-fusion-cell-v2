# Agents

## Cursor Cloud specific instructions

### Overview

**Fusion Cell** is a Next.js 14 (App Router) executive financial command center / family-office management platform. It uses Supabase (hosted PostgreSQL + Auth) as its backend and optionally calls the Anthropic Claude API for an AI assistant feature.

### Running the app

- `npm run dev` starts the dev server on port 3000.
- The app requires a `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Without valid Supabase credentials the app still starts but auth calls return "Invalid API key".
- `ANTHROPIC_API_KEY` is optional; without it only the AI chat feature errors, all other pages work.

### Lint / Build / Test

- **Lint:** `npm run lint` — uses `next lint` with `next/core-web-vitals` and `@typescript-eslint`. The codebase has pre-existing `@typescript-eslint/no-explicit-any` warnings (not errors).
- **Build:** `npm run build` — TypeScript compilation succeeds, but there is a pre-existing type error in `app/api/ai/chat/route.ts:78` (`Argument of type '{}' is not assignable to parameter of type 'string'`). This does **not** block the dev server.
- **Tests:** No automated test framework is configured.

### Authentication & test account

- The app uses Supabase Auth (email/password). A valid account in the Supabase project is required to access any page beyond `/login`.
- Known working test account: `media@phantomservices.com` / `FusionCell` (admin role). This account has full access including admin-only routes (`/admin/*`, `/upload`).
- The user is greeted as "Media" on the dashboard after login.

### Key gotchas

- The repo ships without an `.eslintrc.json`. The first `npm run lint` will prompt interactively. The `.eslintrc.json` with `next/core-web-vitals` and `@typescript-eslint` plugin must be present for lint to run non-interactively.
- Middleware (`middleware.ts`) hits Supabase on every request; with placeholder credentials, unauthenticated routes redirect to `/login` and authenticated routes are unreachable.
- SQL migrations in `/sql/` are meant to be run against the Supabase project, not locally.
- The dev server must be restarted after changing `.env.local` — Next.js does not hot-reload environment variable changes.
