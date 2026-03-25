-- ============================================
-- 008_user_management.sql
-- User Management System for Fusion Cell
-- ============================================

-- 1a. Update role constraint on organization_members
-- Migrate existing roles first, then update constraint
UPDATE organization_members SET role = 'admin' WHERE role = 'owner';
UPDATE organization_members SET role = 'manager' WHERE role = 'accountant';

ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
   CHECK (role IN ('admin', 'manager', 'viewer', 'executive'));

-- 1b. Create principal_assignments table for hybrid scoping
CREATE TABLE IF NOT EXISTS principal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_principal_assignments_user
   ON principal_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_principal_assignments_org
   ON principal_assignments(organization_id);

-- RLS
ALTER TABLE principal_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage principal assignments"
  ON principal_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can see their own assignments"
  ON principal_assignments FOR SELECT
  USING (user_id = auth.uid());

-- 1c. Add fields to profiles table for user management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
   CHECK (status IN ('active', 'invited', 'disabled'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Backfill: existing profiles that have NULL status should be 'active'
UPDATE profiles SET status = 'active' WHERE status IS NULL;
