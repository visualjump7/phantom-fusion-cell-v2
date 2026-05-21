-- 036: Per-user command-page layout pref
--
-- Mirrors the per-(org, executive) principal_layout_config (migration 035)
-- but at the USER level — every signed-in user (admin, manager, executive)
-- can have their own preferred layout for /command. For executives the
-- per-(org, executive) row in principal_layout_config wins (the team
-- controls their experience); for staff (admin / manager) THIS column wins
-- because there's no principal who picked something for them.
--
-- Defaults to 'orbital' so existing users see no change after the migration.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS command_layout TEXT
    NOT NULL DEFAULT 'orbital';

-- Drop any prior version of the constraint before re-adding so re-runs
-- don't fail. The column itself is IF NOT EXISTS so the value survives.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_command_layout_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_command_layout_check
    CHECK (command_layout IN ('orbital', 'briefing'));
