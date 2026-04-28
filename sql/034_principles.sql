-- 034: Principles table
--
-- Per-org list of standing principles (short title + longer description).
-- Used to capture guiding rules and decision frames for a client. Org-scoped:
-- every principal in the org sees the same list. The Fusion Cell team adds /
-- edits / removes principles from /admin/client/[orgId]/principles.
--
-- v1 is a flat list ordered by `position`. The reorder UI isn't built yet —
-- new rows just append (max(position) + 1). The column is here so when we add
-- drag-to-reorder we don't need a follow-up migration.

CREATE TABLE IF NOT EXISTS principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_principles_org_position
  ON principles(organization_id, position);

ALTER TABLE principles ENABLE ROW LEVEL SECURITY;

-- Team (admin/manager) manages everything for their org
DROP POLICY IF EXISTS "Team manages principles" ON principles;
CREATE POLICY "Team manages principles"
  ON principles FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Executives read principles for their own org
DROP POLICY IF EXISTS "Executives read principles" ON principles;
CREATE POLICY "Executives read principles"
  ON principles FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    )
  );
