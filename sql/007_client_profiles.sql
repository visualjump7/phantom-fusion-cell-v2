-- ============================================
-- FUSION CELL: Multi-Client Admin Infrastructure
-- Run in Supabase SQL Editor
-- ============================================

-- Client profiles (extends organizations with admin metadata)
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'paused', 'archived')),
  accent_color TEXT DEFAULT 'amber' CHECK (accent_color IN ('amber', 'blue', 'teal', 'purple', 'coral', 'pink', 'green')),
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  onboarded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user_role
  ON organization_members(user_id, role);

CREATE INDEX IF NOT EXISTS idx_client_profiles_org
  ON client_profiles(organization_id);

-- Seed existing organization with a client profile
INSERT INTO client_profiles (organization_id, display_name, status, accent_color)
SELECT id, name, 'active', 'amber'
FROM organizations
WHERE id = (SELECT organization_id FROM organization_members LIMIT 1)
ON CONFLICT (organization_id) DO NOTHING;

-- Row Level Security
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their client profiles"
  ON client_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can manage their client profiles"
  ON client_profiles FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
