-- 026: Travel feature schema + sample data
--
-- Schema: travel_itineraries / travel_legs / travel_documents tables.
-- The lib/travel-service.ts code has been calling these tables for a while
-- but no migration ever created them, so they may or may not exist on any
-- given environment. CREATE TABLE IF NOT EXISTS makes this idempotent.
--
-- Seed: 5 sample business trips, one per business project from
-- 005_seed_new_assets.sql. Each trip has 3-6 legs covering flights,
-- hotels, ground transport, meetings, restaurants. asset_id is resolved
-- via subquery on asset name so this still works if the seed UUIDs were
-- changed; trips simply land with asset_id=NULL if no match is found.
--
-- Idempotent end to end: CREATE TABLE IF NOT EXISTS, DROP+CREATE for
-- policies, ON CONFLICT DO NOTHING for INSERTs.

-- ============================================
-- 1. SCHEMA
-- ============================================

CREATE TABLE IF NOT EXISTS travel_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  principal_id UUID NULL,
  asset_id UUID NULL REFERENCES assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  trip_start DATE NULL,
  trip_end DATE NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'updated', 'completed', 'cancelled')),
  notes TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES travel_itineraries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  leg_type TEXT NOT NULL
    CHECK (leg_type IN ('flight', 'hotel', 'ground', 'restaurant', 'meeting', 'custom')),
  provider TEXT NULL,
  confirmation_number TEXT NULL,
  departure_location TEXT NULL,
  departure_lat NUMERIC NULL,
  departure_lng NUMERIC NULL,
  arrival_location TEXT NULL,
  arrival_lat NUMERIC NULL,
  arrival_lng NUMERIC NULL,
  departure_time TIMESTAMPTZ NULL,
  arrival_time TIMESTAMPTZ NULL,
  details TEXT NULL,
  contact_name TEXT NULL,
  contact_phone TEXT NULL,
  notes TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES travel_itineraries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  leg_id UUID NULL REFERENCES travel_legs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  document_type TEXT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NULL,
  file_size BIGINT NULL,
  ai_accessible BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes that match the actual queries in lib/travel-service.ts and
-- lib/calendar-system.ts.
CREATE INDEX IF NOT EXISTS idx_travel_itineraries_org_start
  ON travel_itineraries(organization_id, trip_start);
CREATE INDEX IF NOT EXISTS idx_travel_legs_itinerary_position
  ON travel_legs(itinerary_id, position);
CREATE INDEX IF NOT EXISTS idx_travel_legs_org_departure
  ON travel_legs(organization_id, departure_time);
CREATE INDEX IF NOT EXISTS idx_travel_documents_itinerary
  ON travel_documents(itinerary_id);

-- ============================================
-- 2. RLS
-- ============================================

ALTER TABLE travel_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_documents ENABLE ROW LEVEL SECURITY;

-- Itineraries
DROP POLICY IF EXISTS "Team can manage travel itineraries" ON travel_itineraries;
CREATE POLICY "Team can manage travel itineraries"
  ON travel_itineraries FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Principals read published itineraries" ON travel_itineraries;
CREATE POLICY "Principals read published itineraries"
  ON travel_itineraries FOR SELECT USING (
    status = 'published' AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'executive'
    )
  );

-- Legs follow the parent itinerary's policies
DROP POLICY IF EXISTS "Team can manage travel legs" ON travel_legs;
CREATE POLICY "Team can manage travel legs"
  ON travel_legs FOR ALL USING (
    itinerary_id IN (
      SELECT id FROM travel_itineraries WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Principals read legs of published itineraries" ON travel_legs;
CREATE POLICY "Principals read legs of published itineraries"
  ON travel_legs FOR SELECT USING (
    itinerary_id IN (
      SELECT id FROM travel_itineraries WHERE status = 'published' AND organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role = 'executive'
      )
    )
  );

-- Documents — same model
DROP POLICY IF EXISTS "Team can manage travel documents" ON travel_documents;
CREATE POLICY "Team can manage travel documents"
  ON travel_documents FOR ALL USING (
    itinerary_id IN (
      SELECT id FROM travel_itineraries WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Principals read docs of published itineraries" ON travel_documents;
CREATE POLICY "Principals read docs of published itineraries"
  ON travel_documents FOR SELECT USING (
    itinerary_id IN (
      SELECT id FROM travel_itineraries WHERE status = 'published' AND organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role = 'executive'
      )
    )
  );

-- ============================================
-- 3. SEED — 5 trips, one per business project
-- ============================================
--
-- All trips for org 00000000-0000-0000-0000-000000000001 (the seed org
-- used by 001 / 005). asset_id is resolved by name so it's robust to
-- changed UUIDs; if the named asset doesn't exist the trip still inserts
-- with asset_id=NULL.
--
-- Trip dates are deliberately spread across the next 60 days from
-- 2026-04-19 so the Schedule block surfaces something in 7d/14d/30d
-- windows.

-- Trip 1: Solar Projects Portfolio — Q2 TX/AZ inspection (May 5-9)
INSERT INTO travel_itineraries (id, organization_id, asset_id, title, trip_start, trip_end, status, notes)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM assets WHERE name = 'Solar Projects Portfolio' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  'Q2 Solar Sites Inspection — TX & AZ',
  '2026-05-05', '2026-05-09', 'published',
  'Quarterly walkthrough of the AZ utility-scale array plus the new TX expansion site. Bring updated capacity reports.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO travel_legs (id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number, departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng, departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES
('f1000001-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'flight', 0, 'American Airlines', 'AA-9F2K1L', 'Dallas/Fort Worth (DFW)', 32.8998, -97.0403, 'Phoenix Sky Harbor (PHX)', 33.4373, -112.0078, '2026-05-05T07:30:00-05:00', '2026-05-05T08:55:00-07:00', 'AA 1142, Cabin: First, Seat 2A', NULL, NULL, NULL),
('f1000001-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hotel', 1, 'Arizona Biltmore', 'BLT-558823', 'Phoenix, AZ', 33.5114, -112.0202, 'Phoenix, AZ', 33.5114, -112.0202, '2026-05-05T15:00:00-07:00', '2026-05-07T11:00:00-07:00', 'Resort suite, 2 nights', 'Maria Delgado (concierge)', '+1-602-955-6600', NULL),
('f1000001-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'ground', 2, 'Hertz', 'HZ-44A7', 'Phoenix, AZ', 33.4373, -112.0078, 'Yuma, AZ (solar field)', 32.6927, -114.6277, '2026-05-06T07:00:00-07:00', '2026-05-06T10:30:00-07:00', 'SUV rental — desert site access', NULL, NULL, NULL),
('f1000001-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'meeting', 3, 'Yuma Solar Site', NULL, 'Yuma, AZ', 32.6927, -114.6277, 'Yuma, AZ', 32.6927, -114.6277, '2026-05-06T11:00:00-07:00', '2026-05-06T16:00:00-07:00', 'Walkthrough with site engineer + capacity factor review', 'James Reyes (Site Lead)', '+1-928-555-0142', 'Hard hats provided on site'),
('f1000001-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'flight', 4, 'American Airlines', 'AA-9F2K1L', 'Phoenix Sky Harbor (PHX)', 33.4373, -112.0078, 'Dallas/Fort Worth (DFW)', 32.8998, -97.0403, '2026-05-09T13:15:00-07:00', '2026-05-09T17:55:00-05:00', 'AA 2218, Cabin: First, Seat 1B', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Trip 2: AI Data Center — vendor walkthrough (1-day, Apr 28)
INSERT INTO travel_itineraries (id, organization_id, asset_id, title, trip_start, trip_end, status, notes)
VALUES (
  'f0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM assets WHERE name = 'AI Data Center' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  'AI Data Center — NVIDIA Vendor Walkthrough',
  '2026-04-28', '2026-04-28', 'published',
  'Single-day on-site review of the new H200 cluster install. Lunch with the NVIDIA account team.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO travel_legs (id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number, departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng, departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES
('f1000002-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ground', 0, 'Private driver', NULL, 'Dallas Home', 32.7767, -96.7970, 'AI Data Center facility', 32.9483, -96.7299, '2026-04-28T08:30:00-05:00', '2026-04-28T09:15:00-05:00', 'Black SUV — confirmed with driver', 'Marcus T.', '+1-214-555-0179', NULL),
('f1000002-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'meeting', 1, 'NVIDIA Account Team', NULL, 'AI Data Center facility', 32.9483, -96.7299, 'AI Data Center facility', 32.9483, -96.7299, '2026-04-28T09:30:00-05:00', '2026-04-28T12:00:00-05:00', 'H200 cluster review, capacity expansion roadmap', 'Priya Shah (NVIDIA)', '+1-408-555-0188', NULL),
('f1000002-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'restaurant', 2, 'The Capital Grille', NULL, 'Dallas, TX', 32.7878, -96.8045, 'Dallas, TX', 32.7878, -96.8045, '2026-04-28T12:30:00-05:00', '2026-04-28T14:00:00-05:00', 'Lunch with NVIDIA team — table for 5', NULL, '+1-214-303-0500', 'Reservation under "Phantom"'),
('f1000002-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ground', 3, 'Private driver', NULL, 'Dallas, TX', 32.7878, -96.8045, 'Dallas Home', 32.7767, -96.7970, '2026-04-28T14:30:00-05:00', '2026-04-28T15:00:00-05:00', NULL, 'Marcus T.', '+1-214-555-0179', NULL)
ON CONFLICT (id) DO NOTHING;

-- Trip 3: North Texas Real Estate — property review tour (Apr 23-24)
INSERT INTO travel_itineraries (id, organization_id, asset_id, title, trip_start, trip_end, status, notes)
VALUES (
  'f0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM assets WHERE name = 'North Texas Real Estate' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  'North TX Property Review Tour',
  '2026-04-23', '2026-04-24', 'published',
  'Two-day tour of recently renovated Frisco and McKinney holdings. Tenant meetings + condition assessments.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO travel_legs (id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number, departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng, departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES
('f1000003-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ground', 0, 'Private driver', NULL, 'Dallas Home', 32.7767, -96.7970, 'Frisco property — Legacy West', 33.1507, -96.8236, '2026-04-23T09:00:00-05:00', '2026-04-23T10:00:00-05:00', NULL, 'Marcus T.', '+1-214-555-0179', NULL),
('f1000003-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'meeting', 1, 'Cushman & Wakefield', NULL, 'Frisco, TX', 33.1507, -96.8236, 'Frisco, TX', 33.1507, -96.8236, '2026-04-23T10:00:00-05:00', '2026-04-23T13:00:00-05:00', 'Tenant review + Q1 leasing report', 'Helena Kowalski (PM)', '+1-972-555-0211', NULL),
('f1000003-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'hotel', 2, 'Renaissance Plano Legacy West', 'REN-77F12', 'Plano, TX', 33.0760, -96.8167, 'Plano, TX', 33.0760, -96.8167, '2026-04-23T16:00:00-05:00', '2026-04-24T11:00:00-05:00', 'King Suite, 1 night', NULL, '+1-972-578-9000', NULL),
('f1000003-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ground', 3, 'Private driver', NULL, 'Plano, TX', 33.0760, -96.8167, 'McKinney property', 33.1972, -96.6398, '2026-04-24T09:00:00-05:00', '2026-04-24T09:45:00-05:00', NULL, 'Marcus T.', '+1-214-555-0179', NULL),
('f1000003-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'meeting', 4, 'McKinney Site Walkthrough', NULL, 'McKinney, TX', 33.1972, -96.6398, 'McKinney, TX', 33.1972, -96.6398, '2026-04-24T10:00:00-05:00', '2026-04-24T13:00:00-05:00', 'Renovation completion punch list', 'Diego Alvarez (GC)', '+1-214-555-0344', NULL)
ON CONFLICT (id) DO NOTHING;

-- Trip 4: Puerto Rico Real Estate — site visit (Jun 10-13) — kept as draft
INSERT INTO travel_itineraries (id, organization_id, asset_id, title, trip_start, trip_end, status, notes)
VALUES (
  'f0000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM assets WHERE name = 'Puerto Rico Real Estate' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  'Puerto Rico Site Visit — San Juan & Dorado',
  '2026-06-10', '2026-06-13', 'draft',
  'Quarterly review of San Juan office tower + Dorado vacation properties. Draft — confirm flights before publishing.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO travel_legs (id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number, departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng, departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES
('f1000004-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'flight', 0, 'American Airlines', 'AA-PR-22B7', 'Dallas/Fort Worth (DFW)', 32.8998, -97.0403, 'San Juan (SJU)', 18.4394, -66.0018, '2026-06-10T08:00:00-05:00', '2026-06-10T15:30:00-04:00', 'AA 1834, Cabin: First, Seat 1A. Long-haul.', NULL, NULL, NULL),
('f1000004-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'hotel', 1, 'St Regis Bahia Beach', 'STR-991002', 'Río Grande, PR', 18.4060, -65.7959, 'Río Grande, PR', 18.4060, -65.7959, '2026-06-10T17:00:00-04:00', '2026-06-13T11:00:00-04:00', 'Beachfront suite, 3 nights', 'Reservation desk', '+1-787-809-8000', NULL),
('f1000004-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'ground', 2, 'Private driver', NULL, 'Río Grande, PR', 18.4060, -65.7959, 'Dorado, PR', 18.4587, -66.2680, '2026-06-11T09:00:00-04:00', '2026-06-11T10:30:00-04:00', NULL, 'Carlos M.', '+1-787-555-0162', NULL),
('f1000004-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'meeting', 3, 'Dorado Property Manager', NULL, 'Dorado, PR', 18.4587, -66.2680, 'Dorado, PR', 18.4587, -66.2680, '2026-06-11T11:00:00-04:00', '2026-06-11T15:00:00-04:00', 'Walk all 4 vacation rentals + review Q2 occupancy', 'Lourdes Vega (PM)', '+1-787-555-0233', NULL),
('f1000004-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'restaurant', 4, '1919 Restaurant', NULL, 'San Juan, PR', 18.4655, -66.0780, 'San Juan, PR', 18.4655, -66.0780, '2026-06-12T20:00:00-04:00', '2026-06-12T22:00:00-04:00', 'Dinner with PR counsel — table for 4', NULL, '+1-787-721-1919', 'Reservation under "Phantom"'),
('f1000004-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'flight', 5, 'American Airlines', 'AA-PR-22B7', 'San Juan (SJU)', 18.4394, -66.0018, 'Dallas/Fort Worth (DFW)', 32.8998, -97.0403, '2026-06-13T13:00:00-04:00', '2026-06-13T16:55:00-05:00', 'AA 2491, Cabin: First, Seat 2A', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Trip 5: Solar Power Operations — Q2 inspection (May 19-21)
INSERT INTO travel_itineraries (id, organization_id, asset_id, title, trip_start, trip_end, status, notes)
VALUES (
  'f0000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM assets WHERE name = 'Solar Power Operations' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  'Solar Power Ops — Q2 El Paso Inspection',
  '2026-05-19', '2026-05-21', 'published',
  'Generation + distribution facility audit. Bring updated cap-x proposal.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO travel_legs (id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number, departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng, departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES
('f1000005-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'flight', 0, 'Southwest Airlines', 'WN-7M3X', 'Dallas Love Field (DAL)', 32.8472, -96.8517, 'El Paso (ELP)', 31.8067, -106.3781, '2026-05-19T10:00:00-05:00', '2026-05-19T11:25:00-06:00', 'WN 4421, Business Select, Seat A1', NULL, NULL, NULL),
('f1000005-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'hotel', 1, 'Hotel Paso del Norte', 'HPN-3380', 'El Paso, TX', 31.7587, -106.4869, 'El Paso, TX', 31.7587, -106.4869, '2026-05-19T14:00:00-06:00', '2026-05-21T11:00:00-06:00', 'Executive suite, 2 nights', NULL, '+1-915-534-3000', NULL),
('f1000005-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'ground', 2, 'Hertz', 'HZ-991M', 'El Paso (ELP)', 31.8067, -106.3781, 'Solar generation facility', 31.6904, -106.0167, '2026-05-20T07:30:00-06:00', '2026-05-20T08:30:00-06:00', 'SUV rental — site is ~50 mi east', NULL, NULL, NULL),
('f1000005-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'meeting', 3, 'Operations Audit', NULL, 'El Paso area', 31.6904, -106.0167, 'El Paso area', 31.6904, -106.0167, '2026-05-20T09:00:00-06:00', '2026-05-20T17:00:00-06:00', 'Full-day generation + distribution audit + cap-x review', 'Anthony Liu (Ops Director)', '+1-915-555-0297', 'Lunch on site'),
('f1000005-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'flight', 4, 'Southwest Airlines', 'WN-7M3X', 'El Paso (ELP)', 31.8067, -106.3781, 'Dallas Love Field (DAL)', 32.8472, -96.8517, '2026-05-21T15:00:00-06:00', '2026-05-21T18:25:00-05:00', 'WN 6612, Business Select, Seat A1', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
