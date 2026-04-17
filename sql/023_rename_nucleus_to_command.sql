-- 023: Rename default_landing value 'nucleus' → 'command'
--
-- Context: the `/nucleus` route is being renamed to `/command`. The
-- profiles.default_landing column has a CHECK constraint limiting values to
-- ('dashboard','nucleus'). This migration:
--
--   1. Drops whatever CHECK constraint references default_landing
--      (name is auto-generated; we locate it dynamically).
--   2. Backfills existing rows: 'nucleus' → 'command'.
--   3. Updates the column default (if one exists) to 'command'.
--   4. Adds a new named CHECK constraint: ('dashboard','command').
--
-- Run this AFTER the application code has been updated to write 'command'
-- instead of 'nucleus' (end of Phase 2 or during Phase 3). If you need to
-- deploy with no downtime, split into two migrations: widen the constraint
-- to ('dashboard','command','nucleus') first, deploy code, then come back
-- and tighten to ('dashboard','command') once all rows are backfilled.
--
-- Safe to re-run (idempotent).

BEGIN;

-- 1. Drop any existing CHECK constraint on profiles.default_landing.
--    Constraint name isn't fixed because Supabase auto-generates it.
DO $$
DECLARE
  cn TEXT;
BEGIN
  FOR cn IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relname  = 'profiles'
      AND con.contype  = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%default_landing%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', cn);
  END LOOP;
END $$;

-- 2. Backfill: move every existing 'nucleus' row to 'command'.
UPDATE public.profiles
SET default_landing = 'command'
WHERE default_landing = 'nucleus';

-- 3. Update the column default if it was 'nucleus'.
--    (No-op if the default was already 'dashboard' or NULL.)
DO $$
DECLARE
  current_default TEXT;
BEGIN
  SELECT column_default INTO current_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'profiles'
    AND column_name  = 'default_landing';

  IF current_default IS NOT NULL AND current_default ILIKE '%nucleus%' THEN
    ALTER TABLE public.profiles
      ALTER COLUMN default_landing SET DEFAULT 'command';
  END IF;
END $$;

-- 4. Add the new CHECK constraint with a stable name so future migrations
--    can reference it directly.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_landing_check
  CHECK (default_landing IN ('dashboard', 'command'));

COMMIT;

-- Verification queries (run after the migration):
--
--   SELECT default_landing, COUNT(*)
--   FROM public.profiles
--   GROUP BY default_landing;
--   -- Expect: only 'dashboard' and/or 'command', never 'nucleus'.
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
--   -- Expect: profiles_default_landing_check CHECK(... IN ('dashboard','command'))
