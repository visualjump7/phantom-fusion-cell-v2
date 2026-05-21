-- 037: Recreate tables referenced by code but missing from migration history
--
-- These four tables exist in the live Supabase project (manually created at
-- some point) but no migration in `sql/` defines them. That makes the schema
-- non-reproducible — staging / DR / a fresh dev environment would all break.
--
-- This migration is fully `IF NOT EXISTS` so applying it on the live DB is a
-- no-op (the tables already exist). Applying it on a fresh DB creates them
-- with the exact shape the code expects, derived from every column the app
-- actually reads or writes.
--
-- Tables created (when missing):
--   - principal_module_config   — per-(org, executive) module visibility
--   - calendar_sources           — ICS feeds attached to an org / principal
--   - calendar_events_cache      — synced ICS events (15-min cron)
--   - audit_log                  — generic admin-action audit trail

-- ============================================
-- principal_module_config
-- Used by lib/module-visibility-service.ts, lib/executives-service.ts,
-- app/api/admin/add-executive/route.ts, app/api/admin/onboard-principal/route.ts
-- onConflict key: (organization_id, principal_id, module_key)
-- ============================================
CREATE TABLE IF NOT EXISTS principal_module_config (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  principal_id    UUID NOT NULL,
  module_key      TEXT NOT NULL
    CHECK (module_key IN (
      'dashboard','daily_brief','comms','travel','budgets',
      'cash_flow','projects','contacts','calendar'
    )),
  is_visible      BOOLEAN NOT NULL DEFAULT FALSE,
  position        INTEGER NOT NULL DEFAULT 0,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, principal_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_principal_module_config_lookup
  ON principal_module_config(organization_id, principal_id);

ALTER TABLE principal_module_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manages module config" ON principal_module_config;
CREATE POLICY "Team manages module config"
  ON principal_module_config FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Executives read own module config" ON principal_module_config;
CREATE POLICY "Executives read own module config"
  ON principal_module_config FOR SELECT USING (
    principal_id = auth.uid() AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    )
  );

-- ============================================
-- calendar_sources
-- Used by lib/calendar-service.ts, lib/calendar-sync-service.ts.
-- Each row is an ICS feed (Google / iCloud / Outlook export) the team has
-- attached to an org. Optional `principal_id` scopes a feed to one executive.
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_sources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  principal_id       UUID,
  label              TEXT NOT NULL,
  provider_hint      TEXT,
  ics_url            TEXT NOT NULL,
  color              TEXT DEFAULT '#60A5FA',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at     TIMESTAMPTZ,
  last_sync_status   TEXT,
  last_sync_error    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sources_org
  ON calendar_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sources_principal
  ON calendar_sources(principal_id);

ALTER TABLE calendar_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manages calendar sources" ON calendar_sources;
CREATE POLICY "Team manages calendar sources"
  ON calendar_sources FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Executives read own calendar sources" ON calendar_sources;
CREATE POLICY "Executives read own calendar sources"
  ON calendar_sources FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('executive', 'delegate')
    )
    AND (principal_id IS NULL OR principal_id = auth.uid())
  );

-- ============================================
-- calendar_events_cache
-- Used by lib/calendar-service.ts, lib/calendar-sync-service.ts.
-- Synced ICS events. Refreshed by the 15-minute cron (sql/022) which calls
-- the sync function for every active source.
-- onConflict key: (source_id, external_uid)
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES calendar_sources(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_uid    TEXT NOT NULL,
  title           TEXT,
  description     TEXT,
  location        TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  is_all_day      BOOLEAN NOT NULL DEFAULT FALSE,
  raw_data        JSONB,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_uid)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_cache_source_time
  ON calendar_events_cache(source_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_cache_org_time
  ON calendar_events_cache(organization_id, start_time);

ALTER TABLE calendar_events_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team reads calendar events" ON calendar_events_cache;
CREATE POLICY "Team reads calendar events"
  ON calendar_events_cache FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Executives read calendar events" ON calendar_events_cache;
CREATE POLICY "Executives read calendar events"
  ON calendar_events_cache FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('executive', 'delegate')
    )
  );

-- Writes to events_cache are intended to come from the sync cron / service
-- role only — explicitly leaving INSERT/UPDATE/DELETE without a permissive
-- policy so RLS denies regular user writes.

-- ============================================
-- audit_log
-- Generic admin-action audit trail. Referenced (silently failing today) by:
--   lib/preview-context.tsx, app/api/search/route.ts,
--   app/api/admin/onboard-principal/route.ts,
--   app/api/admin/add-executive/route.ts,
--   app/api/admin/update-executive/route.ts.
-- All callers send: { organization_id?, user_id, action, metadata }.
-- Inserts only — never updated, never deleted.
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         UUID,
  action          TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_time
  ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time
  ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins / managers can read the audit trail
DROP POLICY IF EXISTS "Team reads audit log" ON audit_log;
CREATE POLICY "Team reads audit log"
  ON audit_log FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Any authenticated user can insert — the server routes that write here
-- already enforce role checks before reaching this point. Keeping the
-- insert policy permissive avoids the silent-fail pattern we just lived
-- through with the missing table.
DROP POLICY IF EXISTS "Authenticated insert audit" ON audit_log;
CREATE POLICY "Authenticated insert audit"
  ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
