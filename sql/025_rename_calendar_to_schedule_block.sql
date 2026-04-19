-- 025: Rename 'calendar' brief block type -> 'schedule'
--
-- Context: the Daily Brief "Calendar" block experiment aimed to merge
-- internal bills/decisions/travel with external ICS feeds (Apple/Google).
-- After evaluating the reliability + privacy cost of external feeds, we
-- pivoted to an internal-only agenda and renamed the block to "Schedule"
-- to match what it actually does.
--
-- Supersedes 024 (which would have allowed 'calendar'). This migration
-- arrives at the correct final state whether or not 024 was ever applied:
--   - if 024 ran: UPDATE below migrates any existing 'calendar' rows and
--     the CHECK is rebuilt without 'calendar'.
--   - if 024 was skipped: the UPDATE is a no-op and the CHECK is rebuilt
--     from the original 6 types plus 'schedule'.
-- Idempotent — safe to re-run.

UPDATE brief_blocks SET type = 'schedule' WHERE type = 'calendar';

ALTER TABLE brief_blocks DROP CONSTRAINT IF EXISTS brief_blocks_type_check;
ALTER TABLE brief_blocks ADD CONSTRAINT brief_blocks_type_check
  CHECK (type IN (
    'text',
    'cashflow',
    'bills',
    'projects',
    'decisions',
    'document',
    'schedule'
  ));
