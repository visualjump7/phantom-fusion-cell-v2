-- 015: Rename brief block type 'holdings' -> 'projects'

-- 1. Migrate existing data
UPDATE brief_blocks SET type = 'projects' WHERE type = 'holdings';

-- 2. Drop the old CHECK constraint and add the updated one
ALTER TABLE brief_blocks DROP CONSTRAINT IF EXISTS brief_blocks_type_check;
ALTER TABLE brief_blocks ADD CONSTRAINT brief_blocks_type_check
  CHECK (type IN ('text', 'cashflow', 'bills', 'projects', 'decisions', 'document'));
