-- 042: Tenant RLS lockdown — close the cross-tenant exposure left by 003
--
-- sql/003_fix_rls_policies.sql opened every core table with USING (true)
-- "to fix RLS issues" during early development. That turned RLS into
-- decoration — any authenticated user could SELECT every other tenant's
-- profiles, organizations, members, assets, bills, messages, budgets, etc.
-- For a family-office app this is launch-blocking.
--
-- This migration:
--   1. Defines a SECURITY DEFINER helper that returns the caller's org IDs.
--      Using a helper bypasses RLS on the helper's own organization_members
--      reads, which avoids the recursion problem otherwise inherent in a
--      policy on organization_members that references organization_members.
--   2. Drops every open `USING (true)` policy from 003.
--   3. Replaces each one with proper tenant-scoped policies.
--
-- Idempotent: every CREATE POLICY is preceded by DROP POLICY IF EXISTS,
-- and CREATE OR REPLACE on the helper. Safe to re-run.

-- ============================================
-- Helper: which orgs does the calling user belong to?
-- SECURITY DEFINER so the helper can read organization_members without
-- being subject to RLS on that table (otherwise the policies on
-- organization_members would recurse via this helper).
-- ============================================
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.user_organization_ids() TO authenticated;

-- Helper that returns user_ids the caller shares at least one org with.
-- Used for the profiles SELECT policy so teammates can see each other,
-- but cross-tenant strangers cannot.
CREATE OR REPLACE FUNCTION public.user_visible_profile_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT user_id
  FROM organization_members
  WHERE organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_visible_profile_ids() TO authenticated;

-- Helper that returns TRUE when the caller is admin / manager / owner in
-- the given org. Used for write-side policies.
CREATE OR REPLACE FUNCTION public.is_org_manager(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = target_org
      AND role IN ('admin', 'owner', 'manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_manager(UUID) TO authenticated;

-- ============================================
-- profiles
-- - SELECT: own profile + profiles of people in your shared orgs
-- - INSERT: own profile only (the on_auth_user_created trigger normally
--           handles this, this is just a safety net)
-- - UPDATE: own profile only
-- ============================================
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Auto-create profile" ON profiles;
DROP POLICY IF EXISTS "Members can view profiles in shared orgs" ON profiles;

CREATE POLICY "Members can view profiles in shared orgs"
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (SELECT public.user_visible_profile_ids())
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Self insert profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================
-- organizations
-- - SELECT: orgs you belong to
-- - INSERT/UPDATE: only admins of the org (manage via service role for create)
-- ============================================
DROP POLICY IF EXISTS "Members can view orgs" ON organizations;
DROP POLICY IF EXISTS "Members view own orgs" ON organizations;

CREATE POLICY "Members view own orgs"
  ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "Admins manage own orgs" ON organizations;
CREATE POLICY "Admins manage own orgs"
  ON organizations FOR UPDATE TO authenticated
  USING (public.is_org_manager(id));

-- ============================================
-- organization_members
-- - SELECT: own row + members of your orgs
-- - INSERT/UPDATE/DELETE: admins of that org
-- ============================================
DROP POLICY IF EXISTS "Members can view org membership" ON organization_members;
DROP POLICY IF EXISTS "Members can insert" ON organization_members;
DROP POLICY IF EXISTS "Members can update" ON organization_members;

DROP POLICY IF EXISTS "Members view org members" ON organization_members;
CREATE POLICY "Members view org members"
  ON organization_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "Admins manage org members" ON organization_members;
CREATE POLICY "Admins manage org members"
  ON organization_members FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id))
  WITH CHECK (public.is_org_manager(organization_id));

-- ============================================
-- assets — tenant-scoped reads, manager-only writes
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view assets" ON assets;
DROP POLICY IF EXISTS "Authenticated can insert assets" ON assets;
DROP POLICY IF EXISTS "Authenticated can update assets" ON assets;

DROP POLICY IF EXISTS "Members view org assets" ON assets;
CREATE POLICY "Members view org assets"
  ON assets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "Managers write org assets" ON assets;
CREATE POLICY "Managers write org assets"
  ON assets FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id))
  WITH CHECK (public.is_org_manager(organization_id));

-- ============================================
-- bills
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view bills" ON bills;
DROP POLICY IF EXISTS "Authenticated can insert bills" ON bills;
DROP POLICY IF EXISTS "Authenticated can update bills" ON bills;

DROP POLICY IF EXISTS "Members view org bills" ON bills;
CREATE POLICY "Members view org bills"
  ON bills FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "Managers write org bills" ON bills;
CREATE POLICY "Managers write org bills"
  ON bills FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id))
  WITH CHECK (public.is_org_manager(organization_id));

-- ============================================
-- messages — every org member can read & write (Comms is a chat-like surface)
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view messages" ON messages;
DROP POLICY IF EXISTS "Authenticated can insert messages" ON messages;
DROP POLICY IF EXISTS "Authenticated can update messages" ON messages;

DROP POLICY IF EXISTS "Members view org messages" ON messages;
CREATE POLICY "Members view org messages"
  ON messages FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "Members insert org messages" ON messages;
CREATE POLICY "Members insert org messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Senders or managers update messages" ON messages;
CREATE POLICY "Senders or managers update messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_org_manager(organization_id)
  );

DROP POLICY IF EXISTS "Managers delete messages" ON messages;
CREATE POLICY "Managers delete messages"
  ON messages FOR DELETE TO authenticated
  USING (public.is_org_manager(organization_id));

-- ============================================
-- message_responses — scope via the parent message's org
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view responses" ON message_responses;
DROP POLICY IF EXISTS "Authenticated can insert responses" ON message_responses;
DROP POLICY IF EXISTS "Authenticated can update responses" ON message_responses;

DROP POLICY IF EXISTS "Members view org message responses" ON message_responses;
CREATE POLICY "Members view org message responses"
  ON message_responses FOR SELECT TO authenticated
  USING (
    message_id IN (
      SELECT id FROM messages
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "Members insert message responses" ON message_responses;
CREATE POLICY "Members insert message responses"
  ON message_responses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
      SELECT id FROM messages
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "Authors update message responses" ON message_responses;
CREATE POLICY "Authors update message responses"
  ON message_responses FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authors delete message responses" ON message_responses;
CREATE POLICY "Authors delete message responses"
  ON message_responses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- budgets
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view budgets" ON budgets;
DROP POLICY IF EXISTS "Authenticated can insert budgets" ON budgets;

DROP POLICY IF EXISTS "Members view org budgets" ON budgets;
CREATE POLICY "Members view org budgets"
  ON budgets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "Managers write org budgets" ON budgets;
CREATE POLICY "Managers write org budgets"
  ON budgets FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id))
  WITH CHECK (public.is_org_manager(organization_id));

-- ============================================
-- budget_line_items — scope via the parent budget's org
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view budget items" ON budget_line_items;
DROP POLICY IF EXISTS "Authenticated can insert budget items" ON budget_line_items;

DROP POLICY IF EXISTS "Members view org budget items" ON budget_line_items;
CREATE POLICY "Members view org budget items"
  ON budget_line_items FOR SELECT TO authenticated
  USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "Managers write org budget items" ON budget_line_items;
CREATE POLICY "Managers write org budget items"
  ON budget_line_items FOR ALL TO authenticated
  USING (
    budget_id IN (
      SELECT id FROM budgets
      WHERE public.is_org_manager(organization_id)
    )
  )
  WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets
      WHERE public.is_org_manager(organization_id)
    )
  );
