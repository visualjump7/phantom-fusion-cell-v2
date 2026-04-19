-- 024: Allow 'calendar' as a brief_blocks.type
--
-- Context: the Daily Brief popup added a "Calendar" block that merges
-- bills + external ICS calendar feeds (Apple/Google/Outlook) + pending
-- decisions + travel into a single agenda. The CHECK constraint on
-- brief_blocks.type set in 015 only allows the original 6 types, so
-- inserts of type='calendar' silently fail with a constraint violation.
--
-- This migration drops the old constraint and re-adds it with 'calendar'
-- in the allowed set. Idempotent (DROP IF EXISTS).

ALTER TABLE brief_blocks DROP CONSTRAINT IF EXISTS brief_blocks_type_check;
ALTER TABLE brief_blocks ADD CONSTRAINT brief_blocks_type_check
  CHECK (type IN (
    'text',
    'cashflow',
    'bills',
    'projects',
    'decisions',
    'document',
    'calendar'
  ));
