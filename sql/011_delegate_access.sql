-- ============================================
-- Delegate Access System
-- ============================================

-- Add delegate role to organization_members
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('admin', 'manager', 'viewer', 'executive', 'delegate'));

-- Delegate asset access table
CREATE TABLE IF NOT EXISTS delegate_asset_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_delegate_access_user
  ON delegate_asset_access(user_id);
CREATE INDEX IF NOT EXISTS idx_delegate_access_asset
  ON delegate_asset_access(asset_id);
CREATE INDEX IF NOT EXISTS idx_delegate_access_org
  ON delegate_asset_access(organization_id);

-- RLS
ALTER TABLE delegate_asset_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage delegate access"
  ON delegate_asset_access FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Delegates can see their own access"
  ON delegate_asset_access FOR SELECT USING (
    user_id = auth.uid()
  );
