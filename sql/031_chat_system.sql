-- 031: Chat system — Phase 1
--
-- Real-time group chat between principals and their directors. Six new
-- tables, all scoped to organization_id with RLS. Entirely separate from
-- the existing alerts/messages system in messages / message_responses /
-- message_reads — do not mix them.
--
-- Phase 1 brings up schema + basic send/receive. Phase 2 lights up
-- presence/typing/read receipts (chat_message_reads lands here so the
-- foreign-key chain is complete in Phase 1). Phase 3 layers on
-- attachments (chat_messages.has_attachments exists here; the
-- chat_attachments table comes in Phase 3). Phase 4 adds push
-- notifications (device_tokens lands here so the table schema is stable).
--
-- Terminology rules in the audit-log action names:
--   'chat.thread.created'
--   'chat.message.sent'
--   'chat.message.deleted'
--   'chat.participant.added'
--   'chat.participant.removed'
-- Keep these exact — downstream tooling will parse them.

-- ============================================================
-- 1. chat_threads — container for a conversation
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title             TEXT,
  created_by        UUID REFERENCES profiles(id),
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_accessible     BOOLEAN NOT NULL DEFAULT TRUE,
  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_org_last_message
  ON chat_threads(organization_id, last_message_at DESC);

-- ============================================================
-- 2. chat_thread_participants — junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_thread_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('principal', 'director')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  UNIQUE(thread_id, user_id)
);

-- "active participant" lookups (used in every RLS policy) hit this index
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_active
  ON chat_thread_participants(user_id) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_participants_thread
  ON chat_thread_participants(thread_id) WHERE left_at IS NULL;

-- ============================================================
-- 3. chat_messages — immutable once sent; soft delete only
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES profiles(id),
  body              TEXT,
  has_attachments   BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON chat_messages(thread_id, created_at DESC);

-- ============================================================
-- 4. chat_message_reads — per-user read state (Phase 2 uses it)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_reads_user
  ON chat_message_reads(user_id, read_at DESC);

-- ============================================================
-- 5. device_tokens — Phase 4 push. Landing the table now so
--    the schema is stable across phases.
-- ============================================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_version   TEXT,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
  ON device_tokens(user_id);

-- ============================================================
-- 6. chat_audit_log — mirrors budget_audit_log shape
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id         UUID REFERENCES chat_threads(id) ON DELETE SET NULL,
  message_id        UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_org_created
  ON chat_audit_log(organization_id, created_at DESC);

-- ============================================================
-- Trigger: keep chat_threads.last_message_at fresh
-- ============================================================
CREATE OR REPLACE FUNCTION fn_chat_bump_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_threads
     SET last_message_at = NEW.created_at,
         updated_at = NOW()
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_bump_last_message_at ON chat_messages;
CREATE TRIGGER trg_chat_bump_last_message_at
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION fn_chat_bump_last_message_at();

-- ============================================================
-- Helper: thread ids the current auth.uid() is an active participant of.
-- SECURITY DEFINER so this bypasses RLS on chat_thread_participants when
-- called from a policy, which is exactly what lets the participant-scoped
-- policies below avoid self-referential recursion.
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

REVOKE ALL ON FUNCTION public.chat_threads_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_threads_for_current_user() TO authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE chat_threads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_audit_log           ENABLE ROW LEVEL SECURITY;

-- chat_threads: SELECT — only threads where caller is an active participant
DROP POLICY IF EXISTS chat_threads_select ON chat_threads;
CREATE POLICY chat_threads_select ON chat_threads
  FOR SELECT
  USING (id IN (SELECT public.chat_threads_for_current_user()));

-- chat_threads: INSERT — any authenticated user. Matches the rest of
-- this codebase's RLS posture (see sql/003_fix_rls_policies.sql): per-
-- client project isolation is the tenancy boundary; app-layer checks
-- enforce role authority beyond that.
DROP POLICY IF EXISTS chat_threads_insert ON chat_threads;
CREATE POLICY chat_threads_insert ON chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- chat_threads: UPDATE — caller must be a participant (for archive, rename)
DROP POLICY IF EXISTS chat_threads_update ON chat_threads;
CREATE POLICY chat_threads_update ON chat_threads
  FOR UPDATE
  USING (id IN (SELECT public.chat_threads_for_current_user()));

-- chat_thread_participants: SELECT — participants of the same thread can see each other.
-- Must route through the SECURITY DEFINER helper to avoid self-recursion.
DROP POLICY IF EXISTS chat_thread_participants_select ON chat_thread_participants;
CREATE POLICY chat_thread_participants_select ON chat_thread_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR thread_id IN (SELECT public.chat_threads_for_current_user())
  );

-- chat_thread_participants: INSERT — any authenticated user. The app-layer
-- createThread/addParticipant service enforces which director can add whom.
DROP POLICY IF EXISTS chat_thread_participants_insert ON chat_thread_participants;
CREATE POLICY chat_thread_participants_insert ON chat_thread_participants
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- chat_thread_participants: UPDATE — allow setting left_at on self, or by thread participant (for admin removing)
DROP POLICY IF EXISTS chat_thread_participants_update ON chat_thread_participants;
CREATE POLICY chat_thread_participants_update ON chat_thread_participants
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR thread_id IN (SELECT public.chat_threads_for_current_user())
  );

-- chat_messages: SELECT — caller must be an active participant of the thread
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT
  USING (thread_id IN (SELECT public.chat_threads_for_current_user()));

-- chat_messages: INSERT — sender must be the caller (prevents spoofing).
-- Participant scoping is enforced via SELECT policy on reads; write-side
-- enforcement of "must be a participant" is deferred to the service layer
-- to avoid SECURITY DEFINER function caching races right after thread creation.
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- chat_messages: UPDATE — only for soft-delete. Caller must be the sender
-- or a participant flagged as an admin role at the organization_members level.
-- Narrow UPDATE to just the is_deleted/deleted_at/deleted_by columns via the
-- service layer (we cannot easily enforce column-level RLS here; the service
-- is the trusted gate).
DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
        AND organization_id = chat_messages.organization_id
        AND role IN ('admin', 'owner')
        AND status = 'active'
    )
  );

-- chat_message_reads: SELECT + INSERT — caller can only see/manage their own reads
DROP POLICY IF EXISTS chat_message_reads_select ON chat_message_reads;
CREATE POLICY chat_message_reads_select ON chat_message_reads
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_message_reads_insert ON chat_message_reads;
CREATE POLICY chat_message_reads_insert ON chat_message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- device_tokens: full CRUD on own rows
DROP POLICY IF EXISTS device_tokens_select ON device_tokens;
CREATE POLICY device_tokens_select ON device_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_insert ON device_tokens;
CREATE POLICY device_tokens_insert ON device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_update ON device_tokens;
CREATE POLICY device_tokens_update ON device_tokens
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_delete ON device_tokens;
CREATE POLICY device_tokens_delete ON device_tokens
  FOR DELETE USING (user_id = auth.uid());

-- chat_audit_log: SELECT + INSERT — any authenticated user. No UPDATE/DELETE
-- policies means rows are effectively append-only.
DROP POLICY IF EXISTS chat_audit_log_select ON chat_audit_log;
CREATE POLICY chat_audit_log_select ON chat_audit_log
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS chat_audit_log_insert ON chat_audit_log;
CREATE POLICY chat_audit_log_insert ON chat_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- Realtime: only chat_messages gets replication (per spec §5.4).
-- ============================================================
-- Note: run this in the Supabase dashboard (Database → Replication) or via
-- the `alter publication supabase_realtime add table chat_messages;` command
-- if the publication is managed via SQL. Left as a comment here because
-- the publication setup varies per project.
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

COMMENT ON TABLE chat_threads IS 'Phase 1: container for a chat conversation. Separate from the alerts/messages system.';
COMMENT ON TABLE chat_messages IS 'Phase 1: immutable chat messages. Soft delete only via is_deleted.';
COMMENT ON COLUMN chat_messages.has_attachments IS 'Phase 1 placeholder — wired in Phase 3 when chat_attachments ships.';
COMMENT ON TABLE device_tokens IS 'Phase 4 push notifications. Table landed in Phase 1 migration so schema is stable.';
