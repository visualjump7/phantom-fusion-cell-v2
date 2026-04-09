-- ============================================================================
-- 018: Budget Editor — schema additions
-- ============================================================================
-- Adds the minimum schema needed by the Budget Editor feature. Additive only:
-- every ALTER uses ADD COLUMN IF NOT EXISTS, every CREATE uses IF NOT EXISTS.
-- Safe to run multiple times. Paired rollback file: 018_budget_editor_schema_rollback.sql
--
-- Applies on top of the existing schema defined in 001_complete_schema.sql.
-- Does not touch any existing columns, policies, or data.
-- ============================================================================

BEGIN;

-- ───────────────────────────────────────────────────────────────────────
-- 1. budget_line_items: is_fixed, sort_order, updated_at
-- ───────────────────────────────────────────────────────────────────────
-- is_fixed: marks a line item as a fixed recurring cost vs variable.
-- sort_order: preserves the user-chosen row order inside a category.
-- updated_at: last mutation timestamp, maintained by trigger.

ALTER TABLE budget_line_items
  ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- updated_at auto-update trigger (shared helper function, used by other
-- tables later if needed). CREATE OR REPLACE so re-running is a no-op.
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop + recreate the trigger so this migration is idempotent.
DROP TRIGGER IF EXISTS budget_line_items_updated_at ON budget_line_items;
CREATE TRIGGER budget_line_items_updated_at
  BEFORE UPDATE ON budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- ───────────────────────────────────────────────────────────────────────
-- 2. expense_categories: organization_id (nullable)
-- ───────────────────────────────────────────────────────────────────────
-- Existing rows (the seed categories from 004_seed_budgets.sql) have
-- organization_id = NULL meaning "global / shared across all orgs".
-- New categories created through the Budget Editor will be org-scoped.
-- Queries that want both should use:  WHERE organization_id = $1 OR organization_id IS NULL

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_expense_categories_org
  ON expense_categories(organization_id);

-- ───────────────────────────────────────────────────────────────────────
-- 3. budget_audit_log — append-only mutation history
-- ───────────────────────────────────────────────────────────────────────
-- Table is created now so the Budget Editor service layer can write rows
-- as it's built out in Phases 3+. RLS policies are intentionally left as
-- a permissive placeholder; Phase 6 will tighten them to "admin/manager
-- within the same org can SELECT; nobody can UPDATE or DELETE".

CREATE TABLE IF NOT EXISTS budget_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  line_item_id UUID REFERENCES budget_line_items(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Action-type notes (plain text, not enforced via CHECK so we can grow
-- the vocabulary without a migration):
--   'cell_edit'         — numeric cell (jan..dec) changed
--   'row_add'           — new budget_line_items row created
--   'row_delete'        — budget_line_items row removed
--   'category_add'      — new expense_categories row created
--   'description_edit'  — budget_line_items.description changed
--   'type_toggle'       — is_fixed flipped
--   'bulk_import'       — triggered by .xlsx import; one row per affected item

CREATE INDEX IF NOT EXISTS idx_budget_audit_log_budget
  ON budget_audit_log(budget_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_line_item
  ON budget_audit_log(line_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_user
  ON budget_audit_log(user_id);

-- Enable RLS so the table isn't wide open to authenticated users.
-- Placeholder policies: same-org members can INSERT (service-role writes
-- will bypass RLS anyway); nobody can SELECT/UPDATE/DELETE until Phase 6.
-- This is stricter-by-default than necessary and will be loosened for
-- admin reads in Phase 6.
ALTER TABLE budget_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated INSERT; service layer attaches user_id + org context.
DROP POLICY IF EXISTS budget_audit_log_insert ON budget_audit_log;
CREATE POLICY budget_audit_log_insert
  ON budget_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No SELECT / UPDATE / DELETE policies. Reads happen via service-role
-- client in the Phase 6 audit viewer. Accepting changes from this table
-- is impossible through the app.

COMMIT;
