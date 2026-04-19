-- 030: Principal summary-card visibility config
--
-- Per-principal toggles for the "quick-glance" summary cards that appear
-- BELOW the orbital ring on the /command page for principals (executives
-- and delegates). Mirrors the `principal_module_config` pattern used for
-- the orbital module buttons — same org/principal/is_visible/position
-- shape, different card_key set.
--
-- v1 card_key values: 'top_alerts', 'upcoming_travel', 'latest_brief',
-- 'pending_decisions'. The set is kept as a CHECK so typos don't silently
-- create orphan config rows; extend the CHECK when adding cards later.
--
-- Defaults: nothing is visible. Admin explicitly toggles cards on per
-- principal via the Principal Experience admin page. That's intentional —
-- the user asked for "all off by default" so principals get a clean
-- orbital-only view until the admin configures summary cards.

CREATE TABLE IF NOT EXISTS principal_summary_config (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL,
  card_key TEXT NOT NULL
    CHECK (card_key IN (
      'top_alerts',
      'upcoming_travel',
      'latest_brief',
      'pending_decisions'
    )),
  is_visible BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, principal_id, card_key)
);

CREATE INDEX IF NOT EXISTS idx_principal_summary_config_lookup
  ON principal_summary_config(organization_id, principal_id);

ALTER TABLE principal_summary_config ENABLE ROW LEVEL SECURITY;

-- Team (admin/manager) manages everything for their org
DROP POLICY IF EXISTS "Team manages summary config" ON principal_summary_config;
CREATE POLICY "Team manages summary config"
  ON principal_summary_config FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Principals (executives) read their own config rows
DROP POLICY IF EXISTS "Principals read own summary config" ON principal_summary_config;
CREATE POLICY "Principals read own summary config"
  ON principal_summary_config FOR SELECT USING (
    principal_id = auth.uid() AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    )
  );
