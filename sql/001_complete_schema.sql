-- ============================================
-- FUSION CELL V2 — Complete Database Schema
-- Run this in your NEW Supabase project SQL Editor
-- ============================================

-- PROFILES (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  phone TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'accountant', 'executive')) DEFAULT 'executive',
  status TEXT DEFAULT 'active',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ASSET TYPES
CREATE TABLE IF NOT EXISTS asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASSETS
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  type_id UUID REFERENCES asset_types(id),
  category TEXT CHECK (category IN ('family', 'business', 'personal')),
  estimated_value DECIMAL,
  identifier TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  year INTEGER,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT
);

-- BUDGET LINE ITEMS
CREATE TABLE IF NOT EXISTS budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  expense_category_id UUID REFERENCES expense_categories(id),
  description TEXT,
  jan DECIMAL DEFAULT 0, feb DECIMAL DEFAULT 0, mar DECIMAL DEFAULT 0,
  apr DECIMAL DEFAULT 0, may DECIMAL DEFAULT 0, jun DECIMAL DEFAULT 0,
  jul DECIMAL DEFAULT 0, aug DECIMAL DEFAULT 0, sep DECIMAL DEFAULT 0,
  oct DECIMAL DEFAULT 0, nov DECIMAL DEFAULT 0, dec DECIMAL DEFAULT 0,
  annual_total DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  asset_id UUID REFERENCES assets(id),
  sender_id UUID REFERENCES profiles(id),
  type TEXT CHECK (type IN ('alert', 'action_required', 'decision', 'update', 'comment')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  due_date TIMESTAMPTZ,
  is_global BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES profiles(id),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGE READS
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  read_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT FALSE
);

-- MESSAGE RESPONSES
CREATE TABLE IF NOT EXISTS message_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  response_type TEXT CHECK (response_type IN ('approved', 'rejected', 'acknowledged', 'comment')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BILLS
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  asset_id UUID REFERENCES assets(id),
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date DATE NOT NULL,
  category TEXT,
  payee TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  is_recurring BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_asset_id ON bills(asset_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- BILL IMPORTS
CREATE TABLE IF NOT EXISTS bill_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  filename TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  asset_id UUID REFERENCES assets(id),
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UPLOAD LOGS
CREATE TABLE IF NOT EXISTS upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  asset_id UUID REFERENCES assets(id),
  filename TEXT,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI CONVERSATIONS
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- SEED DATA
-- Run this AFTER creating your first user via the Auth UI
-- ============================================

-- Step 1: Create organization
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Jones Family Office', 'jones-fo');

-- Step 2: After signing up your first user, run:
-- (Replace USER_ID with the actual auth.users id)
--
-- INSERT INTO organization_members (organization_id, user_id, role) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'YOUR-USER-ID', 'owner');

-- Step 3: Seed assets
INSERT INTO assets (id, organization_id, name, category, estimated_value, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Aspen Mountain Estate', 'family', 45000000, 'Primary family residence in Aspen, CO'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Miami Beach House', 'family', 22000000, 'Oceanfront property in Miami Beach'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sea Spirit Yacht', 'family', 20000000, '165ft custom yacht'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Downtown Office Tower', 'business', 225000000, 'Class A office building, downtown'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Warehouse Distribution Center', 'business', 180000000, 'Industrial logistics hub'),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Company Fleet Vehicles', 'business', 2000000, 'Fleet of 15 company vehicles'),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Gulfstream G650', 'personal', 18000000, 'Private jet for executive travel'),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Classic Car Collection', 'personal', 3500000, '12 vintage automobiles'),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Art Collection', 'personal', 8500000, 'Contemporary art portfolio'),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Wine Cellar', 'personal', 1200000, '2,400 bottles, investment-grade');

-- Step 4: Seed bills
INSERT INTO bills (organization_id, asset_id, title, amount_cents, due_date, category, payee, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Fuel Delivery - March', 850000, '2026-03-01', 'Fuel', 'Marina Fuel Co', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Crew Payroll - March', 1200000, '2026-03-01', 'Payroll', 'Internal', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Hull Insurance Annual', 4500000, '2026-03-15', 'Insurance', 'Maritime Insurance Group', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Dock Fees - Q1', 750000, '2026-03-31', 'Moorage', 'Palm Beach Marina', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Property Tax - Aspen', 8500000, '2026-03-10', 'Taxes', 'Pitkin County', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Caretaker Service', 450000, '2026-03-01', 'Maintenance', 'Alpine Property Mgmt', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Mortgage Payment', 3200000, '2026-03-05', 'Mortgage', 'First National Bank', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'HOA Fees', 250000, '2026-03-01', 'HOA', 'Beach Club HOA', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'Hangar Lease - Monthly', 850000, '2026-03-01', 'Aviation', 'Teterboro Aviation', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'Pilot Salary - March', 1800000, '2026-03-01', 'Payroll', 'Internal', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'Annual Inspection', 15000000, '2026-04-15', 'Maintenance', 'Gulfstream Service Center', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Office Lease - March', 12500000, '2026-03-01', 'Lease', 'Downtown Properties LLC', 'pending'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Utilities', 350000, '2026-03-15', 'Utilities', 'ConEd', 'pending'),
  ('00000000-0000-0000-0000-000000000001', NULL, 'American Express - Statement', 2800000, '2026-03-20', 'Credit Card', 'American Express', 'pending'),
  ('00000000-0000-0000-0000-000000000001', NULL, 'Life Insurance Premium', 1500000, '2026-03-25', 'Insurance', 'Northwestern Mutual', 'pending'),
  ('00000000-0000-0000-0000-000000000001', NULL, 'CPA Retainer - Q1', 2500000, '2026-03-31', 'Professional', 'Deloitte Private', 'pending'),
  ('00000000-0000-0000-0000-000000000001', NULL, 'American Express - February', 3100000, '2026-02-20', 'Credit Card', 'American Express', 'paid'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Snow Removal - Feb', 180000, '2026-02-15', 'Maintenance', 'Aspen Snow Services', 'paid'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Mortgage Payment - Feb', 3200000, '2026-02-05', 'Mortgage', 'First National Bank', 'paid'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'Jet Fuel - February', 1200000, '2026-02-28', 'Fuel', 'Atlantic Aviation', 'paid');

-- Step 5: Seed messages
INSERT INTO messages (organization_id, asset_id, type, priority, title, body) VALUES
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'decision', 'high', 'Approve yacht hull insurance renewal at $45K/year?', 'Current policy expires March 15. New terms from Maritime Insurance Group attached. Rate increased 8% from last year due to hurricane season adjustments.'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'alert', 'urgent', 'Property tax deadline in 7 days', 'Pitkin County property tax payment of $85,000 is due March 10. Failure to pay on time incurs a 1.5% monthly penalty.'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'action_required', 'high', 'Schedule annual inspection for Gulfstream G650', 'FAA-mandated annual inspection is due April 15. Gulfstream Service Center in Savannah has availability March 28 - April 10. Need to confirm slot.'),
  ('00000000-0000-0000-0000-000000000001', NULL, 'update', 'medium', 'Q1 portfolio review complete', 'Your total portfolio value has increased 3.2% this quarter. Detailed breakdown available in the assets section.'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'update', 'low', 'Office building occupancy update', 'Current occupancy at 94%. Two new lease agreements signed for floors 12 and 15, effective April 1.'),
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'decision', 'medium', 'Consider selling Miami Beach property?', 'Market analysis shows 18% appreciation since purchase. Current offer received at $26M. Recommend reviewing before Q2.');
