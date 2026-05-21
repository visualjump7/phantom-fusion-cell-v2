-- 038: Lock down RLS on tables that were missing it
--
-- Phase 1 audit found six tables with RLS NOT enabled. Three of those
-- (ai_conversations, bill_imports, upload_logs) carry per-org data and
-- without RLS leak across tenants. Three (asset_types, expense_categories,
-- message_reads) are lower-risk but Supabase will still warn. Locking
-- everything down so no table is publicly readable.
--
-- All policies use DROP IF EXISTS first so this migration is idempotent.

-- ============================================
-- ai_conversations — per-user prompts. Owner-scoped read/write.
-- ============================================
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own ai conversations" ON ai_conversations;
CREATE POLICY "Owners read own ai conversations"
  ON ai_conversations FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners write own ai conversations" ON ai_conversations;
CREATE POLICY "Owners write own ai conversations"
  ON ai_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners update own ai conversations" ON ai_conversations;
CREATE POLICY "Owners update own ai conversations"
  ON ai_conversations FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete own ai conversations" ON ai_conversations;
CREATE POLICY "Owners delete own ai conversations"
  ON ai_conversations FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- bill_imports — per-org upload metadata. Team manages, executives read own org.
-- ============================================
ALTER TABLE bill_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team manages bill imports" ON bill_imports;
CREATE POLICY "Team manages bill imports"
  ON bill_imports FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Org members read bill imports" ON bill_imports;
CREATE POLICY "Org members read bill imports"
  ON bill_imports FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- upload_logs — has user_id and asset_id, but NO organization_id column.
-- Scope by ownership (user_id) directly. Team admins can see all logs
-- across the orgs they belong to via the asset → organization join.
-- ============================================
ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own upload logs" ON upload_logs;
CREATE POLICY "Owners read own upload logs"
  ON upload_logs FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners write own upload logs" ON upload_logs;
CREATE POLICY "Owners write own upload logs"
  ON upload_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Team (admin/manager) can read across the asset's org so they can
-- triage failed uploads from a principal account they manage.
DROP POLICY IF EXISTS "Team reads upload logs via asset" ON upload_logs;
CREATE POLICY "Team reads upload logs via asset"
  ON upload_logs FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM assets a
      JOIN organization_members m
        ON m.organization_id = a.organization_id
      WHERE m.user_id = auth.uid() AND m.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- message_reads — per-user read receipts. Owner-only.
-- ============================================
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own message reads" ON message_reads;
CREATE POLICY "Owners read own message reads"
  ON message_reads FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners write own message reads" ON message_reads;
CREATE POLICY "Owners write own message reads"
  ON message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete own message reads" ON message_reads;
CREATE POLICY "Owners delete own message reads"
  ON message_reads FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- asset_types — global lookup. Read-open, write-locked.
-- ============================================
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read asset types" ON asset_types;
CREATE POLICY "Authenticated read asset types"
  ON asset_types FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE not granted — managed by service role only.

-- ============================================
-- expense_categories — global lookup. Same shape as asset_types.
-- ============================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read expense categories" ON expense_categories;
CREATE POLICY "Authenticated read expense categories"
  ON expense_categories FOR SELECT TO authenticated USING (true);
