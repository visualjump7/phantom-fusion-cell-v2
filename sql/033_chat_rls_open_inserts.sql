-- 033: Chat RLS — align INSERT policies with the rest of this codebase.
--
-- The existing app (sql/003_fix_rls_policies.sql) treats a Supabase project
-- as a single-tenant boundary and uses USING (true) WITH CHECK (true) on
-- every write path for the `authenticated` role. Access control beyond that
-- happens at the app layer (hiding UI, enforcing roles in server actions).
--
-- My 031 migration tried to add stricter org-member INSERT gates, which
-- breaks in practice: platform admins have a single `organization_members`
-- row (their admin org) but operate across every client workspace. With
-- the strict policy, they can't create chat threads/participants/messages/
-- audit rows for any org they don't have an explicit membership in.
--
-- SELECT policies stay participant-scoped — that's the real privacy gate
-- for chat content and matches the spec's "users can only see threads
-- they are a participant of" requirement.

-- ============================================================
-- chat_threads: loosen INSERT, keep participant-scoped SELECT
-- ============================================================
DROP POLICY IF EXISTS chat_threads_insert ON chat_threads;
CREATE POLICY chat_threads_insert ON chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- chat_thread_participants: loosen INSERT so directors can invite anyone
-- (SELECT + UPDATE already participant-scoped via helper function)
-- ============================================================
DROP POLICY IF EXISTS chat_thread_participants_insert ON chat_thread_participants;
CREATE POLICY chat_thread_participants_insert ON chat_thread_participants
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- chat_messages: sender must still be the caller (prevents spoofing);
-- drop the participant subquery so creation right after thread setup
-- doesn't race the helper-function cache.
-- ============================================================
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ============================================================
-- chat_audit_log: any authenticated user can insert (service layer
-- is the gate for what action strings are written; audit rows aren't
-- user-controlled data).
-- ============================================================
DROP POLICY IF EXISTS chat_audit_log_insert ON chat_audit_log;
CREATE POLICY chat_audit_log_insert ON chat_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- chat_audit_log: drop the org-match SELECT gate too — same reasoning.
-- Admins need to see the audit trail across workspaces they manage.
-- ============================================================
DROP POLICY IF EXISTS chat_audit_log_select ON chat_audit_log;
CREATE POLICY chat_audit_log_select ON chat_audit_log
  FOR SELECT TO authenticated
  USING (true);
