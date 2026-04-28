-- 032: Chat RLS — break the recursion on chat_thread_participants.
--
-- The SELECT and UPDATE policies created in 031 both contained a subquery
-- against chat_thread_participants itself. Postgres rejects that at query
-- time with:
--
--   infinite recursion detected in policy for relation "chat_thread_participants"
--
-- Fix: a SECURITY DEFINER helper function that returns the set of thread_ids
-- the current user is an active participant of. Because the function runs as
-- its owner (postgres) instead of the caller, the internal SELECT bypasses
-- RLS on chat_thread_participants — no recursion. Policies then call the
-- function instead of doing the subquery inline.
--
-- Safe to re-run: uses CREATE OR REPLACE + DROP POLICY IF EXISTS.

-- ============================================================
-- Helper: thread ids the current auth.uid() is an active participant of
-- ============================================================
CREATE OR REPLACE FUNCTION public.chat_threads_for_current_user()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT thread_id
  FROM chat_thread_participants
  WHERE user_id = auth.uid() AND left_at IS NULL;
$$;

-- Lock down who can call it. Only authenticated users need this.
REVOKE ALL ON FUNCTION public.chat_threads_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_threads_for_current_user() TO authenticated;

-- ============================================================
-- Replace the two recursive policies on chat_thread_participants.
-- Every other table's policy already queries chat_thread_participants
-- from a different-table policy context, so those are safe — but we
-- still route them through the helper function for consistency and a
-- touch of performance (postgres can inline the function in planning).
-- ============================================================

-- chat_thread_participants: SELECT
DROP POLICY IF EXISTS chat_thread_participants_select ON chat_thread_participants;
CREATE POLICY chat_thread_participants_select ON chat_thread_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR thread_id IN (SELECT public.chat_threads_for_current_user())
  );

-- chat_thread_participants: UPDATE
DROP POLICY IF EXISTS chat_thread_participants_update ON chat_thread_participants;
CREATE POLICY chat_thread_participants_update ON chat_thread_participants
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR thread_id IN (SELECT public.chat_threads_for_current_user())
  );

-- ============================================================
-- Refactor the downstream policies to use the helper too. Not strictly
-- required — they worked when standalone — but they were indirectly
-- triggering the recursion via the broken chat_thread_participants
-- SELECT policy. Using the helper is both safer and slightly faster.
-- ============================================================

-- chat_threads: SELECT
DROP POLICY IF EXISTS chat_threads_select ON chat_threads;
CREATE POLICY chat_threads_select ON chat_threads
  FOR SELECT
  USING (id IN (SELECT public.chat_threads_for_current_user()));

-- chat_threads: UPDATE
DROP POLICY IF EXISTS chat_threads_update ON chat_threads;
CREATE POLICY chat_threads_update ON chat_threads
  FOR UPDATE
  USING (id IN (SELECT public.chat_threads_for_current_user()));

-- chat_messages: SELECT
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT
  USING (thread_id IN (SELECT public.chat_threads_for_current_user()));

-- chat_messages: INSERT
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND thread_id IN (SELECT public.chat_threads_for_current_user())
  );
