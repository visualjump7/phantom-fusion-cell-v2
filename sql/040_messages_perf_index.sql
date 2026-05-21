-- 040: Performance index on messages
--
-- The Comms badge query (lib/message-service.ts → fetchMessages, then
-- filtered for type='decision'/'action_required' AND no response) runs on
-- every /command load. The "unresolved" check happens app-side after a
-- join with message_responses, so the DB filter is just on
-- organization_id + type + the soft-delete / archive flags.
--
-- Partial index covers only live rows (the only ones the app ever queries
-- in this hot path). Keeps the query in the milliseconds range as message
-- volume grows.

CREATE INDEX IF NOT EXISTS idx_messages_org_type_live
  ON messages(organization_id, type)
  WHERE is_archived = false
    AND is_deleted  = false;
