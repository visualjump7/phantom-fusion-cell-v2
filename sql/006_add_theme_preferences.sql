-- Add two independent appearance preferences:
-- 1) theme_color: controls light/dark palette
-- 2) theme_density: controls compact/comfort sizing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_color TEXT CHECK (theme_color IN ('dark', 'light')) DEFAULT 'dark';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_density TEXT CHECK (theme_density IN ('compact', 'comfort')) DEFAULT 'compact';

UPDATE profiles
SET theme_color = COALESCE(theme_color, 'dark'),
    theme_density = COALESCE(theme_density, 'compact');
