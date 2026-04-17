# Fusion Cell ↔ Nexus Cell Sync Contract

Canonical copy. Mirrored in `nexus_cell/SYNC_CONTRACT.md`. When either copy
changes, update both in the same sync session.

## Shared (must stay in sync)

- Supabase schema for: `profiles`, `organizations`, `organization_members`,
  `project_blocks`, `project_contacts`, `project_images`
- AI chat pipeline architecture only — snapshot fetcher, system-prompt
  builder, conversation persistence. **NOT** prompt copy / voice.
- PDF report generation (brief → PDF via `@react-pdf/renderer`,
  `html-to-pdf-blocks`)
- Budget / bill calendar **logic** (parsers, calendar math, fiscal
  calendar, `BillDrawer`, `CalendarView`, `ImportDialog`, `budget-parser`,
  `bill-parser`). Ingestion sources are not shared — see below.
- Auth primitives (Supabase client factory pattern, session-refresh
  middleware helper, auth callback route). **NOT** middleware role-routing
  logic.
- shadcn-style UI primitives (`button`, `input`, `card`, `badge`, `cn()`
  helper)
- Project-detail block components (`GalleryBlock`, `NotesBlock`,
  `PersonnelBlock`, `SubcontractorBlock`)

## Fusion-specific (do not port to Nexus)

- Multi-tenant org structure (`client_profiles` table, multi-client admin
  console)
- Phantom team admin views (`app/admin/*` tree)
- Delegate system (`delegate_asset_access`, delegate role, delegate modals)
- Assets / holdings domain (Nexus uses `projects` — no `assets` table)
- Briefs tied to assets (briefs in Nexus are org-level if/when adopted)
- Messages feature (`app/messages/`, `lib/message-service.ts`)
- Theme density / hybrid modes (Fusion has 3 themes × 2 densities; Nexus
  is single-theme dark)
- `OrbitalCommand` UI (Nexus uses `NexusOrb` / `ModuleOrb` instead)
- `allowed_categories` table (per-client expense gating)
- `asset_locations` table
- Middleware role routing (Fusion ~200 lines; Nexus stays thin)

## Nexus-specific (do not port to Fusion)

- App Store build config + mobile/tablet-optimized layouts
- Individual-account auth flow (if/when it diverges from org-based)
- Executive-assistant AI system prompt (voice, copy — **NOT** architecture)
- QuickBooks integration (`lib/quickbooks.ts`, `app/api/quickbooks/*`,
  `sql/005_quickbooks_connections.sql`, `QuickBooksBanner`)
- Bills schema extensions: `currency`, `paid_date`, `paid_by`,
  `payment_method`, `receipt_url`, `quickbooks_synced`, `quickbooks_id`
- Trips / `trip_segments` (with lat/lng) / `travel_docs` /
  `loyalty_programs`
- Alerts + approvals workflow
- Tasks, Notes (org-level)
- Gifts / Subscriptions / Memberships (lifestyle module)
- `audit_log` table
- Role taxonomy: `principal` / `ea` / `cfo` / `admin` / `viewer`
- `(home)` / `(app)` / `(modules)` route group architecture
- `NexusOrb` / `NexusCorner` / `ModuleOrb` / `OrbLayout` / `PrincipalHome`
  branding
- `vercel.json` nested install strategy

## Ingestion sources (divergent, not shared)

- **Fusion bills/budgets:** Excel upload only.
- **Nexus bills/budgets:** Excel upload + QuickBooks API + future
  accounting integrations.

## Sync cadence

- Fusion is source of truth for shared code.
- Cadence: **event-driven** — sync when a feature lands in Fusion that
  touches a "Shared" category above.
- Last sync: **2026-04-17** — initial audit, Phase 0 setup. No ports yet.
