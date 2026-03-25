-- ============================================
-- Daily Briefs System
-- ============================================

-- Briefs table
CREATE TABLE IF NOT EXISTS briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Daily Brief',
  brief_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brief blocks (ordered content sections within a brief)
CREATE TABLE IF NOT EXISTS brief_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'cashflow', 'bills', 'holdings', 'decisions', 'document')),
  position INTEGER NOT NULL DEFAULT 0,
  content_html TEXT,  -- for text and document blocks (rich text / mammoth output)
  config JSONB DEFAULT '{}',  -- block-specific settings (e.g., {"days_ahead": 7} for bills)
  commentary TEXT,  -- optional team note that appears below a data block
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_briefs_org_status ON briefs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_briefs_org_date ON briefs(organization_id, brief_date DESC);
CREATE INDEX IF NOT EXISTS idx_brief_blocks_brief ON brief_blocks(brief_id, position);

-- RLS
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage briefs for their orgs"
  ON briefs FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR
    organization_id IN (
      SELECT organization_id FROM principal_assignments
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Principals can read published briefs"
  ON briefs FOR SELECT USING (
    status = 'published' AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    )
  );

CREATE POLICY "Team can manage brief blocks"
  ON brief_blocks FOR ALL USING (
    brief_id IN (SELECT id FROM briefs WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    ))
  );

CREATE POLICY "Principals can read published brief blocks"
  ON brief_blocks FOR SELECT USING (
    brief_id IN (SELECT id FROM briefs WHERE status = 'published' AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    ))
  );
