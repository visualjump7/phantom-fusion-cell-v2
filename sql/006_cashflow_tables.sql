-- ============================================
-- CASH FLOW MODULE — Database Tables
-- Run in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS cashflow_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL CHECK (section IN ('cash_in', 'cash_out', 'investments')),
  asset_id UUID REFERENCES assets(id),
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cashflow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id UUID REFERENCES cashflow_line_items(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  source_file TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cashflow_entries_date ON cashflow_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_line_item ON cashflow_entries(line_item_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_direction ON cashflow_entries(direction);

ALTER TABLE cashflow_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON cashflow_line_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON cashflow_entries FOR ALL USING (auth.role() = 'authenticated');
