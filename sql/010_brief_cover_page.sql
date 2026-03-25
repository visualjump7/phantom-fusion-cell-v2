-- ============================================
-- Brief Cover Page Fields
-- ============================================

ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cover_title TEXT DEFAULT 'Daily Brief';
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cover_subtitle TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cover_logo_url TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cover_show_date BOOLEAN DEFAULT true;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cover_show_principal BOOLEAN DEFAULT true;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cover_accent_color TEXT DEFAULT '#4ade80';
