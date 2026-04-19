-- 028: Link 8 of the seeded contacts to their business projects
--
-- The contacts from 027 were all inserted as `is_global=true` with
-- `block_id=NULL`, which is why nothing shows the project affiliation
-- in the Contacts module — there's no link back to an asset.
--
-- This migration:
--   1. Creates one `personnel` project_block per business asset (idempotent,
--      via fixed UUIDs + ON CONFLICT). Each block is the anchor for its
--      project's contacts list.
--   2. Updates 8 contacts to point at the right block, flip them off
--      global, and set a contact_type (personnel / subcontractor) so they
--      filter correctly.
--
-- Safe to re-run — the UPDATEs match by id; if the rows don't exist (027
-- not applied yet) they're no-ops.

-- ============================================
-- 1. PROJECT BLOCKS — one `personnel` block per business asset
-- ============================================

INSERT INTO project_blocks (id, asset_id, organization_id, type, title, position)
SELECT
  'b0000000-0000-0000-0000-000000000001'::uuid,
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'personnel',
  'Key Contacts',
  0
FROM assets
WHERE name = 'Solar Projects Portfolio'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_blocks (id, asset_id, organization_id, type, title, position)
SELECT
  'b0000000-0000-0000-0000-000000000002'::uuid,
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'personnel',
  'Key Contacts',
  0
FROM assets
WHERE name = 'AI Data Center'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_blocks (id, asset_id, organization_id, type, title, position)
SELECT
  'b0000000-0000-0000-0000-000000000003'::uuid,
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'personnel',
  'Key Contacts',
  0
FROM assets
WHERE name = 'North Texas Real Estate'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_blocks (id, asset_id, organization_id, type, title, position)
SELECT
  'b0000000-0000-0000-0000-000000000004'::uuid,
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'personnel',
  'Key Contacts',
  0
FROM assets
WHERE name = 'Puerto Rico Real Estate'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_blocks (id, asset_id, organization_id, type, title, position)
SELECT
  'b0000000-0000-0000-0000-000000000005'::uuid,
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'personnel',
  'Key Contacts',
  0
FROM assets
WHERE name = 'Solar Power Operations'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. WIRE CONTACTS TO THEIR PROJECTS
-- ============================================
--
-- Move contact off "global" by setting is_global=false, give it a
-- contact_type so the Personnel/Subcontractor filter chips work, and
-- point block_id at the relevant project's personnel block.

-- Solar Projects Portfolio — James Reyes (site lead, subcontractor) +
-- Maria Delgado (concierge, personnel).
UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'subcontractor',
  block_id = 'b0000000-0000-0000-0000-000000000001'
WHERE id = 'c0000000-0000-0000-0000-000000000002';

UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'personnel',
  block_id = 'b0000000-0000-0000-0000-000000000001'
WHERE id = 'c0000000-0000-0000-0000-000000000001';

-- AI Data Center — Priya Shah (NVIDIA, subcontractor/vendor).
UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'subcontractor',
  block_id = 'b0000000-0000-0000-0000-000000000002'
WHERE id = 'c0000000-0000-0000-0000-000000000004';

-- North Texas Real Estate — Helena Kowalski (PM, personnel) +
-- Diego Alvarez (GC, subcontractor).
UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'personnel',
  block_id = 'b0000000-0000-0000-0000-000000000003'
WHERE id = 'c0000000-0000-0000-0000-000000000005';

UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'subcontractor',
  block_id = 'b0000000-0000-0000-0000-000000000003'
WHERE id = 'c0000000-0000-0000-0000-000000000006';

-- Puerto Rico Real Estate — Carlos Méndez (driver, personnel) +
-- Lourdes Vega (PM, personnel).
UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'personnel',
  block_id = 'b0000000-0000-0000-0000-000000000004'
WHERE id = 'c0000000-0000-0000-0000-000000000007';

UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'personnel',
  block_id = 'b0000000-0000-0000-0000-000000000004'
WHERE id = 'c0000000-0000-0000-0000-000000000008';

-- Solar Power Operations — Anthony Liu (Ops Director, personnel).
UPDATE project_contacts SET
  is_global = FALSE,
  contact_type = 'personnel',
  block_id = 'b0000000-0000-0000-0000-000000000005'
WHERE id = 'c0000000-0000-0000-0000-000000000009';

-- The remaining 9 contacts (Marcus Thompson, Robert Chen, Sarah Williams,
-- David Park, Emma Harrison, Capt. O'Brien, Dr. Hayes, Ramon Cortez,
-- Natasha Petrov) stay `is_global=true` — they serve the whole family
-- office across projects and shouldn't be filed under any single asset.
