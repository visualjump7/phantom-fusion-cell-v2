-- ============================================
-- MIGRATION: Add confirmation workflow to message responses
-- Run this in Supabase SQL Editor
-- ============================================

-- Add confirmation columns to message_responses
ALTER TABLE message_responses 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS confirmation_note TEXT;

-- Update the response_type check to include 'confirmed'
-- (we keep the old constraint and the confirmed state is tracked via confirmed_at)
