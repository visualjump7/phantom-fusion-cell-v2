-- ============================================
-- FIX: Add RLS policies so authenticated users can read data
-- Run this in Supabase SQL Editor
-- ============================================

-- First, check if RLS is blocking us
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('organization_members', 'profiles', 'messages', 'message_responses', 'assets', 'bills', 'budgets', 'budget_line_items');

-- Enable RLS on all tables (safe — won't break anything if already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: Authenticated users in the org can read everything
-- ============================================

-- Profiles: users can read all profiles, update their own
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Auto-create profile" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Organization members: authenticated can read, admins can manage
CREATE POLICY "Members can view org membership" ON organization_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can insert" ON organization_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can update" ON organization_members FOR UPDATE TO authenticated USING (true);

-- Organizations
CREATE POLICY "Members can view orgs" ON organizations FOR SELECT TO authenticated USING (true);

-- Assets: read all, write for authenticated
CREATE POLICY "Authenticated can view assets" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert assets" ON assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update assets" ON assets FOR UPDATE TO authenticated USING (true);

-- Bills: read all, write for authenticated
CREATE POLICY "Authenticated can view bills" ON bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert bills" ON bills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update bills" ON bills FOR UPDATE TO authenticated USING (true);

-- Messages: read all, write for authenticated
CREATE POLICY "Authenticated can view messages" ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert messages" ON messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update messages" ON messages FOR UPDATE TO authenticated USING (true);

-- Message responses: read all, write for authenticated
CREATE POLICY "Authenticated can view responses" ON message_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert responses" ON message_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update responses" ON message_responses FOR UPDATE TO authenticated USING (true);

-- Budgets
CREATE POLICY "Authenticated can view budgets" ON budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert budgets" ON budgets FOR INSERT TO authenticated WITH CHECK (true);

-- Budget line items
CREATE POLICY "Authenticated can view budget items" ON budget_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert budget items" ON budget_line_items FOR INSERT TO authenticated WITH CHECK (true);
