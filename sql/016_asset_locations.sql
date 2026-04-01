-- Add location fields to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_type TEXT
  DEFAULT 'unlocated'
  CHECK (location_type IN (
    'precise',    -- exact lat/lng (address or coordinates entered)
    'city',       -- city-level approximation
    'country',    -- country centroid only
    'unlocated'   -- no location data
  ));

-- Index for spatial queries (simple B-tree, not PostGIS)
CREATE INDEX IF NOT EXISTS idx_assets_location
  ON assets(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Map visibility toggle per organization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  show_globe_map BOOLEAN DEFAULT true;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
