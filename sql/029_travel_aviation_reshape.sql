-- 029: Rewrite the 5 demo travel itineraries in the aviation pattern:
--        flight → car service → hotel → car service → meeting → reverse
--
-- The trips from 026 were a mix (some local driving, some flight-based).
-- User asked for a consistent private-aviation shape where every trip
-- flies into an airport, takes a luxury car service to the hotel, drives
-- to the meeting, and flies home. Two of the originally-local trips (AI
-- Data Center vendor visit, North TX Real Estate review) are pivoted to
-- out-of-town destinations where flying makes sense:
--   - AI Data Center → trip to NVIDIA HQ in Santa Clara, CA
--   - North TX Real Estate → Austin portfolio review (AUS)
--
-- Providers standardized:
--   - NetJets for all flights (private aviation is the family-office norm)
--   - Blacklane for executive ground service across all car legs
--
-- Idempotent: DELETE existing legs for our 5 seed itineraries then
-- re-INSERT with fresh UUIDs and new shape. Itinerary rows are UPDATEd
-- in place so any user-added notes survive (aside from our overwrite of
-- title/notes/dates).

-- ============================================
-- 1. CLEAR OUT OLD LEGS FOR OUR 5 SEED ITINERARIES
-- ============================================

DELETE FROM travel_legs WHERE itinerary_id IN (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-000000000005'
);

-- ============================================
-- 2. UPDATE ITINERARY METADATA (pivots + new notes)
-- ============================================

UPDATE travel_itineraries SET
  title = 'Q2 Solar Sites Inspection — Phoenix & Yuma',
  trip_start = '2026-05-05',
  trip_end = '2026-05-09',
  status = 'published',
  notes = 'Quarterly walkthrough of the Arizona utility-scale array. NetJets from DAL, Blacklane ground throughout, Arizona Biltmore home base.'
WHERE id = 'f0000000-0000-0000-0000-000000000001';

UPDATE travel_itineraries SET
  asset_id = (SELECT id FROM assets WHERE name = 'AI Data Center' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  title = 'AI Data Center — NVIDIA HQ Visit (Santa Clara)',
  trip_start = '2026-04-28',
  trip_end = '2026-04-30',
  status = 'published',
  notes = 'On-site with NVIDIA leadership at Santa Clara HQ — H200 cluster roadmap + next-gen B-series allocation. Rosewood Sand Hill.'
WHERE id = 'f0000000-0000-0000-0000-000000000002';

UPDATE travel_itineraries SET
  asset_id = (SELECT id FROM assets WHERE name = 'North Texas Real Estate' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
  title = 'Austin Portfolio Review',
  trip_start = '2026-04-23',
  trip_end = '2026-04-24',
  status = 'published',
  notes = 'Same-day review of the Austin holdings within the broader TX portfolio. Downtown walkthroughs + tenant meetings. Four Seasons overnight.'
WHERE id = 'f0000000-0000-0000-0000-000000000003';

UPDATE travel_itineraries SET
  title = 'Puerto Rico Site Visit — San Juan & Dorado',
  trip_start = '2026-06-10',
  trip_end = '2026-06-13',
  status = 'draft',
  notes = 'Quarterly review of SJ office tower + Dorado vacation rentals. Draft — confirm NetJets slot + hotel before publishing.'
WHERE id = 'f0000000-0000-0000-0000-000000000004';

UPDATE travel_itineraries SET
  title = 'Solar Power Ops — Q2 El Paso Inspection',
  trip_start = '2026-05-19',
  trip_end = '2026-05-21',
  status = 'published',
  notes = 'Generation + distribution facility audit, cap-x review. Hotel Paso del Norte home base.'
WHERE id = 'f0000000-0000-0000-0000-000000000005';

-- ============================================
-- 3. RE-INSERT LEGS — aviation pattern per trip
-- ============================================

-- ─── Trip 1: Solar Projects Portfolio (Phoenix / Yuma) ───────────────
-- DAL → PHX → Biltmore → Yuma site → Biltmore → PHX → DAL

INSERT INTO travel_legs
(id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number,
 departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng,
 departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES

('f2000001-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'flight', 0, 'NetJets', 'NJ-8421K',
 'Dallas Love Field (DAL)', 32.8472, -96.8517, 'Phoenix Sky Harbor (PHX)', 33.4373, -112.0078,
 '2026-05-05T08:00:00-05:00', '2026-05-05T09:10:00-07:00',
 'Cessna Citation Longitude. 2h 10m block time.', NULL, NULL, NULL),

('f2000001-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'ground', 1, 'Blacklane', 'BL-PHX-5521',
 'Phoenix Sky Harbor (PHX)', 33.4373, -112.0078, 'Arizona Biltmore', 33.5114, -112.0202,
 '2026-05-05T09:30:00-07:00', '2026-05-05T10:05:00-07:00',
 'Mercedes S-Class. Driver meets on FBO ramp.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000001-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'hotel', 2, 'Arizona Biltmore', 'BLT-558823',
 'Arizona Biltmore', 33.5114, -112.0202, 'Arizona Biltmore', 33.5114, -112.0202,
 '2026-05-05T15:00:00-07:00', '2026-05-09T11:00:00-07:00',
 'Presidential suite, 4 nights. In-suite dining set up for Tuesday.', 'Maria Delgado (concierge)', '+1-602-955-6600', NULL),

('f2000001-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'ground', 3, 'Blacklane', 'BL-PHX-5522',
 'Arizona Biltmore', 33.5114, -112.0202, 'Yuma Solar Field', 32.6927, -114.6277,
 '2026-05-06T07:30:00-07:00', '2026-05-06T10:30:00-07:00',
 'Cadillac Escalade ESV. 3h drive west across desert.', 'Blacklane dispatch', '+1-800-555-0820', 'Site entry via south gate — driver has gate code'),

('f2000001-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'meeting', 4, 'Yuma Solar Site Walkthrough', NULL,
 'Yuma Solar Field', 32.6927, -114.6277, 'Yuma Solar Field', 32.6927, -114.6277,
 '2026-05-06T11:00:00-07:00', '2026-05-06T16:00:00-07:00',
 'Walkthrough with site engineer + capacity factor review + Q2 generation projections.',
 'James Reyes (Site Lead)', '+1-928-555-0142', 'Hard hats and PPE provided on site'),

('f2000001-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'ground', 5, 'Blacklane', 'BL-PHX-5523',
 'Yuma Solar Field', 32.6927, -114.6277, 'Arizona Biltmore', 33.5114, -112.0202,
 '2026-05-06T16:30:00-07:00', '2026-05-06T19:30:00-07:00',
 'Same Escalade, same driver — return east to Phoenix.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000001-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'ground', 6, 'Blacklane', 'BL-PHX-5524',
 'Arizona Biltmore', 33.5114, -112.0202, 'Phoenix Sky Harbor (PHX)', 33.4373, -112.0078,
 '2026-05-09T12:00:00-07:00', '2026-05-09T12:40:00-07:00',
 'Mercedes S-Class to FBO.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000001-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'flight', 7, 'NetJets', 'NJ-8421R',
 'Phoenix Sky Harbor (PHX)', 33.4373, -112.0078, 'Dallas Love Field (DAL)', 32.8472, -96.8517,
 '2026-05-09T13:30:00-07:00', '2026-05-09T17:40:00-05:00',
 'Cessna Citation Longitude return. 2h 10m block time.', NULL, NULL, NULL);

-- ─── Trip 2: AI Data Center — NVIDIA HQ Santa Clara ──────────────────
-- DAL → SJC → Rosewood Sand Hill → NVIDIA HQ → Rosewood → SJC → DAL

INSERT INTO travel_legs
(id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number,
 departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng,
 departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES

('f2000002-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'flight', 0, 'NetJets', 'NJ-6612A',
 'Dallas Love Field (DAL)', 32.8472, -96.8517, 'San Jose Intl (SJC)', 37.3639, -121.9289,
 '2026-04-28T08:00:00-05:00', '2026-04-28T09:45:00-07:00',
 'Cessna Citation Latitude. 3h 45m block.', NULL, NULL, NULL),

('f2000002-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'ground', 1, 'Blacklane', 'BL-SFO-7701',
 'San Jose Intl (SJC)', 37.3639, -121.9289, 'Rosewood Sand Hill', 37.4245, -122.2042,
 '2026-04-28T10:15:00-07:00', '2026-04-28T10:55:00-07:00',
 'Mercedes S-Class. Driver meets at Signature FBO.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000002-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'hotel', 2, 'Rosewood Sand Hill', 'RW-330091',
 'Rosewood Sand Hill', 37.4245, -122.2042, 'Rosewood Sand Hill', 37.4245, -122.2042,
 '2026-04-28T13:00:00-07:00', '2026-04-30T11:00:00-07:00',
 'Villa suite, 2 nights.', NULL, '+1-650-561-1500', NULL),

('f2000002-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'ground', 3, 'Blacklane', 'BL-SFO-7702',
 'Rosewood Sand Hill', 37.4245, -122.2042, 'NVIDIA HQ', 37.3701, -121.9638,
 '2026-04-29T08:00:00-07:00', '2026-04-29T08:30:00-07:00',
 'Drive to Santa Clara campus. Building Endeavor.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000002-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'meeting', 4, 'NVIDIA — Executive Briefing', NULL,
 'NVIDIA HQ', 37.3701, -121.9638, 'NVIDIA HQ', 37.3701, -121.9638,
 '2026-04-29T09:00:00-07:00', '2026-04-29T15:00:00-07:00',
 'H200 cluster deployment status, B-series allocation, multi-year roadmap. Lunch on-campus.',
 'Priya Shah (Account)', '+1-408-555-0188', NULL),

('f2000002-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'ground', 5, 'Blacklane', 'BL-SFO-7703',
 'NVIDIA HQ', 37.3701, -121.9638, 'Rosewood Sand Hill', 37.4245, -122.2042,
 '2026-04-29T15:15:00-07:00', '2026-04-29T15:50:00-07:00',
 NULL, 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000002-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'ground', 6, 'Blacklane', 'BL-SFO-7704',
 'Rosewood Sand Hill', 37.4245, -122.2042, 'San Jose Intl (SJC)', 37.3639, -121.9289,
 '2026-04-30T12:00:00-07:00', '2026-04-30T12:40:00-07:00',
 NULL, 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000002-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'flight', 7, 'NetJets', 'NJ-6612B',
 'San Jose Intl (SJC)', 37.3639, -121.9289, 'Dallas Love Field (DAL)', 32.8472, -96.8517,
 '2026-04-30T13:30:00-07:00', '2026-04-30T18:45:00-05:00',
 'Cessna Citation Latitude return. 3h 15m block.', NULL, NULL, NULL);

-- ─── Trip 3: North Texas RE — Austin Portfolio Review ────────────────
-- DAL → AUS → Four Seasons → Austin property → AUS → DAL

INSERT INTO travel_legs
(id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number,
 departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng,
 departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES

('f2000003-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'flight', 0, 'NetJets', 'NJ-4120A',
 'Dallas Love Field (DAL)', 32.8472, -96.8517, 'Austin-Bergstrom (AUS)', 30.1975, -97.6664,
 '2026-04-23T08:30:00-05:00', '2026-04-23T09:25:00-05:00',
 'Embraer Phenom 300. 55m block — shortest trip of the quarter.', NULL, NULL, NULL),

('f2000003-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'ground', 1, 'Blacklane', 'BL-AUS-3381',
 'Austin-Bergstrom (AUS)', 30.1975, -97.6664, 'Four Seasons Austin', 30.2672, -97.7431,
 '2026-04-23T09:45:00-05:00', '2026-04-23T10:15:00-05:00',
 'Mercedes S-Class to downtown.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000003-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'hotel', 2, 'Four Seasons Hotel Austin', 'FS-AUS-9910',
 'Four Seasons Austin', 30.2672, -97.7431, 'Four Seasons Austin', 30.2672, -97.7431,
 '2026-04-23T14:00:00-05:00', '2026-04-24T11:00:00-05:00',
 'Lake Tower suite, 1 night.', NULL, '+1-512-478-4500', NULL),

('f2000003-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'ground', 3, 'Blacklane', 'BL-AUS-3382',
 'Four Seasons Austin', 30.2672, -97.7431, 'Austin downtown property', 30.2729, -97.7447,
 '2026-04-23T10:45:00-05:00', '2026-04-23T11:00:00-05:00',
 'Short hop — 4-block drive, driver on standby for return.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000003-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'meeting', 4, 'Austin Tenant Review + Property Walkthrough', NULL,
 'Austin downtown property', 30.2729, -97.7447, 'Austin downtown property', 30.2729, -97.7447,
 '2026-04-23T11:00:00-05:00', '2026-04-23T15:30:00-05:00',
 'Walk all 3 floors + tenant Q1 leasing review + Q2 rate discussion.',
 'Helena Kowalski (PM)', '+1-972-555-0211', NULL),

('f2000003-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'ground', 5, 'Blacklane', 'BL-AUS-3383',
 'Four Seasons Austin', 30.2672, -97.7431, 'Austin-Bergstrom (AUS)', 30.1975, -97.6664,
 '2026-04-24T09:30:00-05:00', '2026-04-24T10:00:00-05:00',
 NULL, 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000003-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'flight', 6, 'NetJets', 'NJ-4120B',
 'Austin-Bergstrom (AUS)', 30.1975, -97.6664, 'Dallas Love Field (DAL)', 32.8472, -96.8517,
 '2026-04-24T10:45:00-05:00', '2026-04-24T11:40:00-05:00',
 'Phenom 300 return.', NULL, NULL, NULL);

-- ─── Trip 4: Puerto Rico — San Juan + Dorado (DRAFT) ─────────────────
-- DAL → SJU → St Regis → Dorado → St Regis → San Juan office → St Regis → SJU → DAL

INSERT INTO travel_legs
(id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number,
 departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng,
 departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES

('f2000004-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'flight', 0, 'NetJets', 'NJ-9844A',
 'Dallas Love Field (DAL)', 32.8472, -96.8517, 'San Juan (SJU)', 18.4394, -66.0018,
 '2026-06-10T08:00:00-05:00', '2026-06-10T14:30:00-04:00',
 'Gulfstream G450. 5h 30m block — long-haul for the quarter.', NULL, NULL, NULL),

('f2000004-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'ground', 1, 'Blacklane', 'BL-SJU-2204',
 'San Juan (SJU)', 18.4394, -66.0018, 'St Regis Bahia Beach', 18.4060, -65.7959,
 '2026-06-10T15:00:00-04:00', '2026-06-10T15:45:00-04:00',
 'Mercedes S-Class. 45m east along PR-3.', 'Blacklane dispatch (PR)', '+1-787-555-0820', NULL),

('f2000004-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'hotel', 2, 'St Regis Bahia Beach', 'STR-991002',
 'St Regis Bahia Beach', 18.4060, -65.7959, 'St Regis Bahia Beach', 18.4060, -65.7959,
 '2026-06-10T17:00:00-04:00', '2026-06-13T11:00:00-04:00',
 'Beachfront presidential suite, 3 nights.', 'Reservation desk', '+1-787-809-8000', NULL),

('f2000004-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'ground', 3, 'Blacklane', 'BL-SJU-2205',
 'St Regis Bahia Beach', 18.4060, -65.7959, 'Dorado, PR', 18.4587, -66.2680,
 '2026-06-11T09:00:00-04:00', '2026-06-11T10:30:00-04:00',
 '1h 30m west along coast to Dorado.', 'Blacklane dispatch (PR)', '+1-787-555-0820', NULL),

('f2000004-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'meeting', 4, 'Dorado Vacation Portfolio Walkthrough', NULL,
 'Dorado, PR', 18.4587, -66.2680, 'Dorado, PR', 18.4587, -66.2680,
 '2026-06-11T11:00:00-04:00', '2026-06-11T15:30:00-04:00',
 'Walk all 4 vacation rentals + review Q2 occupancy + discuss H2 renovation scope.',
 'Lourdes Vega (PM)', '+1-787-555-0233', NULL),

('f2000004-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'ground', 5, 'Blacklane', 'BL-SJU-2206',
 'Dorado, PR', 18.4587, -66.2680, 'St Regis Bahia Beach', 18.4060, -65.7959,
 '2026-06-11T16:00:00-04:00', '2026-06-11T17:30:00-04:00',
 NULL, 'Blacklane dispatch (PR)', '+1-787-555-0820', NULL),

('f2000004-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'ground', 6, 'Blacklane', 'BL-SJU-2207',
 'St Regis Bahia Beach', 18.4060, -65.7959, 'San Juan Office Tower', 18.4655, -66.0780,
 '2026-06-12T09:00:00-04:00', '2026-06-12T10:00:00-04:00',
 NULL, 'Blacklane dispatch (PR)', '+1-787-555-0820', NULL),

('f2000004-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'meeting', 7, 'San Juan Office Tower Review', NULL,
 'San Juan Office Tower', 18.4655, -66.0780, 'San Juan Office Tower', 18.4655, -66.0780,
 '2026-06-12T10:00:00-04:00', '2026-06-12T16:00:00-04:00',
 'Commercial tenant Q1 review + Q2 leasing forecast + PR counsel on entity filings.',
 'Reyes & Vázquez Legal', '+1-787-555-0411', NULL),

('f2000004-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'ground', 8, 'Blacklane', 'BL-SJU-2208',
 'St Regis Bahia Beach', 18.4060, -65.7959, 'San Juan (SJU)', 18.4394, -66.0018,
 '2026-06-13T12:00:00-04:00', '2026-06-13T12:45:00-04:00',
 NULL, 'Blacklane dispatch (PR)', '+1-787-555-0820', NULL),

('f2000004-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'flight', 9, 'NetJets', 'NJ-9844B',
 'San Juan (SJU)', 18.4394, -66.0018, 'Dallas Love Field (DAL)', 32.8472, -96.8517,
 '2026-06-13T13:30:00-04:00', '2026-06-13T17:30:00-05:00',
 'Gulfstream G450 return. 5h block.', NULL, NULL, NULL);

-- ─── Trip 5: Solar Power Ops — El Paso Q2 ────────────────────────────
-- DAL → ELP → Hotel Paso del Norte → solar generation facility → hotel → ELP → DAL

INSERT INTO travel_legs
(id, itinerary_id, organization_id, leg_type, position, provider, confirmation_number,
 departure_location, departure_lat, departure_lng, arrival_location, arrival_lat, arrival_lng,
 departure_time, arrival_time, details, contact_name, contact_phone, notes) VALUES

('f2000005-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'flight', 0, 'NetJets', 'NJ-5518A',
 'Dallas Love Field (DAL)', 32.8472, -96.8517, 'El Paso Intl (ELP)', 31.8067, -106.3781,
 '2026-05-19T09:00:00-05:00', '2026-05-19T09:55:00-06:00',
 'Phenom 300. 1h 55m block.', NULL, NULL, NULL),

('f2000005-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'ground', 1, 'Blacklane', 'BL-ELP-4410',
 'El Paso Intl (ELP)', 31.8067, -106.3781, 'Hotel Paso del Norte', 31.7587, -106.4869,
 '2026-05-19T10:15:00-06:00', '2026-05-19T10:45:00-06:00',
 'Cadillac Escalade to downtown.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000005-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'hotel', 2, 'Hotel Paso del Norte', 'HPN-3380',
 'Hotel Paso del Norte', 31.7587, -106.4869, 'Hotel Paso del Norte', 31.7587, -106.4869,
 '2026-05-19T14:00:00-06:00', '2026-05-21T11:00:00-06:00',
 'Executive suite, 2 nights.', NULL, '+1-915-534-3000', NULL),

('f2000005-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'ground', 3, 'Blacklane', 'BL-ELP-4411',
 'Hotel Paso del Norte', 31.7587, -106.4869, 'Solar generation facility', 31.6904, -106.0167,
 '2026-05-20T07:00:00-06:00', '2026-05-20T08:00:00-06:00',
 'Escalade — site is ~50 mi east of downtown.', 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000005-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'meeting', 4, 'Operations Audit + Cap-X Review', NULL,
 'Solar generation facility', 31.6904, -106.0167, 'Solar generation facility', 31.6904, -106.0167,
 '2026-05-20T08:30:00-06:00', '2026-05-20T17:00:00-06:00',
 'Full-day generation + distribution audit + cap-x proposal review. Working lunch on site.',
 'Anthony Liu (Ops Director)', '+1-915-555-0297', NULL),

('f2000005-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'ground', 5, 'Blacklane', 'BL-ELP-4412',
 'Solar generation facility', 31.6904, -106.0167, 'Hotel Paso del Norte', 31.7587, -106.4869,
 '2026-05-20T17:30:00-06:00', '2026-05-20T18:30:00-06:00',
 NULL, 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000005-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'ground', 6, 'Blacklane', 'BL-ELP-4413',
 'Hotel Paso del Norte', 31.7587, -106.4869, 'El Paso Intl (ELP)', 31.8067, -106.3781,
 '2026-05-21T13:00:00-06:00', '2026-05-21T13:30:00-06:00',
 NULL, 'Blacklane dispatch', '+1-800-555-0820', NULL),

('f2000005-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'flight', 7, 'NetJets', 'NJ-5518B',
 'El Paso Intl (ELP)', 31.8067, -106.3781, 'Dallas Love Field (DAL)', 32.8472, -96.8517,
 '2026-05-21T14:30:00-06:00', '2026-05-21T17:20:00-05:00',
 'Phenom 300 return. 1h 50m block.', NULL, NULL, NULL);
