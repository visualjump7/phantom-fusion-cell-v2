-- 012: Add allowed_categories column to client_profiles
-- Configures which asset categories (business, personal, family) are available per principal.

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS allowed_categories TEXT[] DEFAULT ARRAY['business', 'personal', 'family'];

-- Backfill: ensure all existing rows have the default
UPDATE client_profiles
  SET allowed_categories = ARRAY['business', 'personal', 'family']
  WHERE allowed_categories IS NULL;
