-- 027: project_contacts schema top-up + sample data
--
-- Schema: lib/contacts-service.ts references columns (`is_global`,
-- `contact_category`) + allows NULL `contact_type` for global contacts,
-- but the committed schema at 013_project_detail.sql doesn't have those.
-- Whichever env you applied that migration on has probably been getting
-- silent failures on `createGlobalContact`. This top-up makes both halves
-- consistent before seeding.
--
-- Seed: 17 global contacts for org 00000000-0000-0000-0000-000000000001.
--   9 are travel-adjacent (same people referenced in travel_legs.contact_*
--   from 026) so trips link to real contacts when the UI wants that; 8
--   are family-office staples (attorney, wealth advisor, CPA, household
--   staff, pilot, concierge medical, security, executive assistant).
-- All idempotent via ON CONFLICT DO NOTHING on fixed UUIDs.

-- ============================================
-- 1. SCHEMA TOP-UP
-- ============================================

-- Allow NULL contact_type — global contacts have no "personnel vs subcontractor"
-- bucket (that's a per-asset concept). PostgreSQL treats NULL as passing the
-- existing CHECK, so we only need to drop the NOT NULL.
ALTER TABLE project_contacts
  ALTER COLUMN contact_type DROP NOT NULL;

-- is_global: whether this contact shows up in the org-wide contacts module
-- regardless of project linkage.
ALTER TABLE project_contacts
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

-- contact_category: matches the enum shape in lib/contacts-service.ts.
ALTER TABLE project_contacts
  ADD COLUMN IF NOT EXISTS contact_category TEXT
  CHECK (contact_category IS NULL OR contact_category IN (
    'attorney', 'broker', 'crew', 'property_manager', 'household_staff',
    'medical', 'security', 'vendor', 'family', 'other'
  ));

CREATE INDEX IF NOT EXISTS idx_project_contacts_org_global
  ON project_contacts(organization_id, is_global);

-- ============================================
-- 2. SEED — 17 global contacts
-- ============================================
--
-- Use deterministic UUIDs (c0000000 prefix) so re-running is a no-op.

-- --------- Travel-adjacent contacts (same people named in travel_legs) ---------

INSERT INTO project_contacts
  (id, organization_id, block_id, is_global, contact_type, contact_category, name, email, phone, role, company_name, notes)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'vendor', 'Maria Delgado', 'm.delgado@arizonabiltmore.com', '+1-602-955-6600',
    'Concierge', 'Arizona Biltmore',
    'Primary contact for suite bookings; flags preferred guest.'),

  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'vendor', 'James Reyes', 'j.reyes@solarproj.com', '+1-928-555-0142',
    'Site Lead — Yuma Solar Field', 'Solar Projects Portfolio',
    'Escorts on-site visits. Hard hats and PPE provided by site.'),

  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'crew', 'Marcus Thompson', 'marcus.t@phantom.example', '+1-214-555-0179',
    'Private driver — Dallas metro', 'Phantom Services',
    'Preferred driver for Dallas-area moves; owns black SUV.'),

  ('c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'vendor', 'Priya Shah', 'p.shah@nvidia.com', '+1-408-555-0188',
    'Account Manager', 'NVIDIA',
    'Primary contact for AI Data Center H200 cluster + expansion roadmap.'),

  ('c0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'property_manager', 'Helena Kowalski', 'h.kowalski@cushwake.com', '+1-972-555-0211',
    'Property Manager — North TX Portfolio', 'Cushman & Wakefield',
    'Handles Frisco, Plano, McKinney holdings. Monthly reports.'),

  ('c0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'vendor', 'Diego Alvarez', 'diego@alvarezbuilt.com', '+1-214-555-0344',
    'General Contractor', 'Alvarez Built',
    'GC for McKinney renovation; on call for punch-list walk-throughs.'),

  ('c0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'crew', 'Carlos Méndez', 'carlos@pr-services.example', '+1-787-555-0162',
    'Private driver — Puerto Rico', 'PR Executive Services',
    'Bilingual. Based San Juan, covers Dorado / Río Grande.'),

  ('c0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'property_manager', 'Lourdes Vega', 'lvega@doradopm.example', '+1-787-555-0233',
    'Property Manager — Dorado Vacation Rentals', 'Dorado PM Group',
    'Manages 4 vacation units. Quarterly occupancy reports.'),

  ('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'vendor', 'Anthony Liu', 'a.liu@solarops.com', '+1-915-555-0297',
    'Operations Director', 'Solar Power Operations',
    'Runs El Paso generation + distribution facility. Owns cap-x proposal.'),

-- --------- Family-office staples ---------

  ('c0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'attorney', 'Robert Chen', 'r.chen@chenassociates.law', '+1-214-555-0400',
    'Managing Partner', 'Chen & Associates LLP',
    'Primary counsel: trust, entity, and real-estate matters.'),

  ('c0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'broker', 'Sarah Williams', 's.williams@gs.com', '+1-212-555-0288',
    'Wealth Advisor — Private Wealth', 'Goldman Sachs',
    'Primary relationship for liquid portfolio + treasury strategy.'),

  ('c0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'other', 'David Park', 'david@parkcpa.com', '+1-214-555-0517',
    'CPA', 'Park & Associates',
    'Tax prep, quarterly filings, entity compliance.'),

  ('c0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'household_staff', 'Emma Harrison', 'e.harrison@phantom.example', '+1-214-555-0601',
    'Head of Household — Dallas Residence', NULL,
    'Coordinates house staff, vendors, schedule.'),

  ('c0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'crew', 'Captain Mike O''Brien', 'mike.obrien@netjets.example', '+1-614-555-0729',
    'Pilot — Account Captain', 'NetJets',
    'Primary account pilot. Schedules via NetJets ops.'),

  ('c0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'medical', 'Dr. Jennifer Hayes', 'j.hayes@concierge-med.example', '+1-214-555-0810',
    'Concierge Medical — Dallas', 'Premier Concierge Medicine',
    '24/7 on-call. Same-day appointments, house calls.'),

  ('c0000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'security', 'Ramon Cortez', 'r.cortez@phantom.example', '+1-214-555-0955',
    'Director of Security', 'Phantom Services',
    'Runs residential + travel-advance security. Licensed in TX + PR.'),

  ('c0000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', NULL, TRUE, NULL,
    'household_staff', 'Natasha Petrov', 'n.petrov@phantom.example', '+1-214-555-1022',
    'Executive Assistant', NULL,
    'Primary EA — calendar, travel bookings, correspondence.')
ON CONFLICT (id) DO NOTHING;
