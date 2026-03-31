-- ============================================
-- Project Detail — Block-Based Directory & Gallery System
-- ============================================

-- Project blocks: container table for ordered sections
CREATE TABLE IF NOT EXISTS project_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('gallery', 'personnel', 'subcontractor', 'notes')),
  title TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_blocks_asset
  ON project_blocks(asset_id, position);

-- Project contacts: personnel and subcontractors
CREATE TABLE IF NOT EXISTS project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES project_blocks(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('personnel', 'subcontractor')),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on-leave', 'completed', 'terminated')),
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  role TEXT,
  company TEXT,
  department TEXT,
  company_name TEXT,
  trade TEXT,
  contract_value_cents INTEGER,
  contract_start DATE,
  contract_end DATE,
  license_number TEXT,
  insurance_on_file BOOLEAN DEFAULT FALSE,
  insurance_expiry DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_block
  ON project_contacts(block_id, position);

-- Project images: gallery images
CREATE TABLE IF NOT EXISTS project_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES project_blocks(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  taken_at DATE,
  file_name TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_images_block
  ON project_images(block_id, position);

-- Storage bucket for project images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload project images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view project images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-images');

-- RLS
ALTER TABLE project_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage project blocks"
  ON project_blocks FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage project contacts"
  ON project_contacts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage project images"
  ON project_images FOR ALL USING (auth.uid() IS NOT NULL);
