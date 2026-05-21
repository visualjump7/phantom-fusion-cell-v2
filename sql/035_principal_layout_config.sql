-- 035: Principal command-page layout config
--
-- Per-executive choice of how the /command page is rendered. Two values:
--   'orbital'  — modules orbit the central sphere (current default)
--   'briefing' — list-based layout with greeting + section index
--
-- The admin sets this from /admin/client/[orgId]/principal-experience, the
-- same page that controls per-executive module visibility. Defaults to
-- 'orbital' so existing executives see no change until an admin opts them in.
--
-- Mirrors the principal_module_config / principal_summary_config pattern:
-- one row per (org, executive), CHECK on the enum, RLS giving the team full
-- access and executives read of their own row.

CREATE TABLE IF NOT EXISTS principal_layout_config (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL,
  layout TEXT NOT NULL DEFAULT 'orbital'
    CHECK (layout IN ('orbital', 'briefing')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  PRIMARY KEY (organization_id, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_principal_layout_config_lookup
  ON principal_layout_config(organization_id, principal_id);

ALTER TABLE principal_layout_config ENABLE ROW LEVEL SECURITY;

-- Team (admin/manager) manages everything for their org
DROP POLICY IF EXISTS "Team manages layout config" ON principal_layout_config;
CREATE POLICY "Team manages layout config"
  ON principal_layout_config FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Executives read their own layout pref
DROP POLICY IF EXISTS "Executives read own layout config" ON principal_layout_config;
CREATE POLICY "Executives read own layout config"
  ON principal_layout_config FOR SELECT USING (
    principal_id = auth.uid() AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    )
  );
