-- ============================================================================
-- 018 ROLLBACK: Budget Editor — schema additions
-- ============================================================================
-- Reverses sql/018_budget_editor_schema.sql. Run this in the Supabase SQL
-- editor if you need to back out the Budget Editor schema changes.
--
-- WARNING: Running this will PERMANENTLY DELETE:
--   * budget_line_items.is_fixed / sort_order / updated_at columns (and their data)
--   * expense_categories.organization_id column (and any org-scoped categories)
--   * the entire budget_audit_log table (and all audit history)
--
-- It will NOT delete the shared set_updated_at_timestamp() function —
-- other tables may depend on it. Drop it manually if you're sure nothing
-- else uses it.
-- ============================================================================

BEGIN;

-- 3. budget_audit_log (drop last, in reverse order of creation)
DROP TABLE IF EXISTS budget_audit_log;

-- 2. expense_categories.organization_id
DROP INDEX IF EXISTS idx_expense_categories_org;
ALTER TABLE expense_categories DROP COLUMN IF EXISTS organization_id;

-- 1. budget_line_items additions + trigger
DROP TRIGGER IF EXISTS budget_line_items_updated_at ON budget_line_items;

ALTER TABLE budget_line_items
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS is_fixed;

-- set_updated_at_timestamp() is intentionally left in place. Uncomment the
-- next line ONLY if you're certain no other table or trigger uses it.
-- DROP FUNCTION IF EXISTS set_updated_at_timestamp();

COMMIT;
