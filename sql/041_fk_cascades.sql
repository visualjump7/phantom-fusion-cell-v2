-- 041: Foreign-key cascade retrofit
--
-- Phase 1 audit found ~25 FK columns with NO ACTION (the implicit default),
-- which is why "Delete Principal" and "Remove user" silently fail today —
-- Postgres refuses the parent delete because of the orphans pointing in.
--
-- This migration retrofits CASCADE / SET NULL on every FK that needs one,
-- per the table reviewed in chat:
--
--   CASCADE   — child belongs to parent; delete parent → drop child
--               (memberships, assets, bills, messages, view-config, etc.
--                tied to an org or a user)
--
--   SET NULL  — attribution column; delete parent → keep row, null pointer
--               (created_by, archived_by, sender_id, uploaded_by, etc.)
--
-- All ALTERs are idempotent — DROP CONSTRAINT IF EXISTS first, then re-add
-- with the desired ON DELETE rule. Constraint names follow the Postgres
-- default `{table}_{column}_fkey` (the names assigned when the original
-- `REFERENCES col(id)` clause was created in the schema).
--
-- WARNING: this changes deletion behavior. The first time a DELETE runs on
-- a parent table, child rows will be cleaned up automatically. Until that
-- delete runs, nothing happens — no data is touched by this migration.

-- ============================================
-- profiles — self-referential audit pointer
-- ============================================
ALTER TABLE IF EXISTS profiles
  DROP CONSTRAINT IF EXISTS profiles_invited_by_fkey;
ALTER TABLE IF EXISTS profiles
  ADD CONSTRAINT profiles_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- organization_members — invited_by is attribution
-- (user_id and organization_id already CASCADE from 001)
-- ============================================
ALTER TABLE IF EXISTS organization_members
  DROP CONSTRAINT IF EXISTS organization_members_invited_by_fkey;
ALTER TABLE IF EXISTS organization_members
  ADD CONSTRAINT organization_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- assets — org owns asset (CASCADE); type / deleted_by are attribution
-- ============================================
ALTER TABLE IF EXISTS assets
  DROP CONSTRAINT IF EXISTS assets_organization_id_fkey;
ALTER TABLE IF EXISTS assets
  ADD CONSTRAINT assets_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS assets
  DROP CONSTRAINT IF EXISTS assets_type_id_fkey;
ALTER TABLE IF EXISTS assets
  ADD CONSTRAINT assets_type_id_fkey
    FOREIGN KEY (type_id) REFERENCES asset_types(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS assets
  DROP CONSTRAINT IF EXISTS assets_deleted_by_fkey;
ALTER TABLE IF EXISTS assets
  ADD CONSTRAINT assets_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- budgets — owned by org and asset
-- (asset_id already CASCADE from 001)
-- ============================================
ALTER TABLE IF EXISTS budgets
  DROP CONSTRAINT IF EXISTS budgets_organization_id_fkey;
ALTER TABLE IF EXISTS budgets
  ADD CONSTRAINT budgets_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS budgets
  DROP CONSTRAINT IF EXISTS budgets_asset_id_fkey;
ALTER TABLE IF EXISTS budgets
  ADD CONSTRAINT budgets_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS budgets
  DROP CONSTRAINT IF EXISTS budgets_created_by_fkey;
ALTER TABLE IF EXISTS budgets
  ADD CONSTRAINT budgets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- budget_line_items — expense category lookup
-- (budget_id already CASCADE from 001)
-- ============================================
ALTER TABLE IF EXISTS budget_line_items
  DROP CONSTRAINT IF EXISTS budget_line_items_expense_category_id_fkey;
ALTER TABLE IF EXISTS budget_line_items
  ADD CONSTRAINT budget_line_items_expense_category_id_fkey
    FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id) ON DELETE SET NULL;

-- ============================================
-- expense_categories — org-scoped categories vanish with org
-- ============================================
ALTER TABLE IF EXISTS expense_categories
  DROP CONSTRAINT IF EXISTS expense_categories_organization_id_fkey;
ALTER TABLE IF EXISTS expense_categories
  ADD CONSTRAINT expense_categories_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- messages — owned by org/asset; senders/archivers/deleters are attribution
-- ============================================
ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_organization_id_fkey;
ALTER TABLE IF EXISTS messages
  ADD CONSTRAINT messages_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_asset_id_fkey;
ALTER TABLE IF EXISTS messages
  ADD CONSTRAINT messages_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS messages
  ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_archived_by_fkey;
ALTER TABLE IF EXISTS messages
  ADD CONSTRAINT messages_archived_by_fkey
    FOREIGN KEY (archived_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_deleted_by_fkey;
ALTER TABLE IF EXISTS messages
  ADD CONSTRAINT messages_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- message_reads — per-user receipts; gone with the user
-- (message_id already CASCADE from 001)
-- ============================================
ALTER TABLE IF EXISTS message_reads
  DROP CONSTRAINT IF EXISTS message_reads_user_id_fkey;
ALTER TABLE IF EXISTS message_reads
  ADD CONSTRAINT message_reads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================
-- message_responses — keep the response; drop user pointers
-- (message_id already CASCADE from 001)
-- ============================================
ALTER TABLE IF EXISTS message_responses
  DROP CONSTRAINT IF EXISTS message_responses_user_id_fkey;
ALTER TABLE IF EXISTS message_responses
  ADD CONSTRAINT message_responses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS message_responses
  DROP CONSTRAINT IF EXISTS message_responses_confirmed_by_fkey;
ALTER TABLE IF EXISTS message_responses
  ADD CONSTRAINT message_responses_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- bills — owned by org/asset; uploader is attribution
-- ============================================
ALTER TABLE IF EXISTS bills
  DROP CONSTRAINT IF EXISTS bills_organization_id_fkey;
ALTER TABLE IF EXISTS bills
  ADD CONSTRAINT bills_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS bills
  DROP CONSTRAINT IF EXISTS bills_asset_id_fkey;
ALTER TABLE IF EXISTS bills
  ADD CONSTRAINT bills_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS bills
  DROP CONSTRAINT IF EXISTS bills_uploaded_by_fkey;
ALTER TABLE IF EXISTS bills
  ADD CONSTRAINT bills_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- bill_imports — owned by org/asset; uploader is attribution
-- ============================================
ALTER TABLE IF EXISTS bill_imports
  DROP CONSTRAINT IF EXISTS bill_imports_organization_id_fkey;
ALTER TABLE IF EXISTS bill_imports
  ADD CONSTRAINT bill_imports_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS bill_imports
  DROP CONSTRAINT IF EXISTS bill_imports_asset_id_fkey;
ALTER TABLE IF EXISTS bill_imports
  ADD CONSTRAINT bill_imports_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS bill_imports
  DROP CONSTRAINT IF EXISTS bill_imports_uploaded_by_fkey;
ALTER TABLE IF EXISTS bill_imports
  ADD CONSTRAINT bill_imports_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- upload_logs — per-user / per-asset
-- ============================================
ALTER TABLE IF EXISTS upload_logs
  DROP CONSTRAINT IF EXISTS upload_logs_user_id_fkey;
ALTER TABLE IF EXISTS upload_logs
  ADD CONSTRAINT upload_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS upload_logs
  DROP CONSTRAINT IF EXISTS upload_logs_asset_id_fkey;
ALTER TABLE IF EXISTS upload_logs
  ADD CONSTRAINT upload_logs_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

-- ============================================
-- ai_conversations — personal data; gone with the user
-- ============================================
ALTER TABLE IF EXISTS ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey;
ALTER TABLE IF EXISTS ai_conversations
  ADD CONSTRAINT ai_conversations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================
-- principal_assignments — owned by user/org; assigner is attribution
-- (user_id and organization_id already CASCADE from 008)
-- ============================================
ALTER TABLE IF EXISTS principal_assignments
  DROP CONSTRAINT IF EXISTS principal_assignments_assigned_by_fkey;
ALTER TABLE IF EXISTS principal_assignments
  ADD CONSTRAINT principal_assignments_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- briefs — publishers/creators are attribution
-- (organization_id already CASCADE from 009)
-- ============================================
ALTER TABLE IF EXISTS briefs
  DROP CONSTRAINT IF EXISTS briefs_published_by_fkey;
ALTER TABLE IF EXISTS briefs
  ADD CONSTRAINT briefs_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS briefs
  DROP CONSTRAINT IF EXISTS briefs_created_by_fkey;
ALTER TABLE IF EXISTS briefs
  ADD CONSTRAINT briefs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- delegate_asset_access — grantor is attribution
-- (user_id, asset_id, organization_id already CASCADE from 011)
-- ============================================
ALTER TABLE IF EXISTS delegate_asset_access
  DROP CONSTRAINT IF EXISTS delegate_asset_access_granted_by_fkey;
ALTER TABLE IF EXISTS delegate_asset_access
  ADD CONSTRAINT delegate_asset_access_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- project_blocks — creator is attribution
-- (asset_id, organization_id already CASCADE from 013)
-- ============================================
ALTER TABLE IF EXISTS project_blocks
  DROP CONSTRAINT IF EXISTS project_blocks_created_by_fkey;
ALTER TABLE IF EXISTS project_blocks
  ADD CONSTRAINT project_blocks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- project_images — uploader is attribution
-- (block_id, organization_id already CASCADE from 013)
-- ============================================
ALTER TABLE IF EXISTS project_images
  DROP CONSTRAINT IF EXISTS project_images_uploaded_by_fkey;
ALTER TABLE IF EXISTS project_images
  ADD CONSTRAINT project_images_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
