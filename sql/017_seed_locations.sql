-- Seed location data for Traust Structured demo assets
-- Run after 016_asset_locations.sql

-- Gulf Coast WtE — Corpus Christi, TX
UPDATE assets SET
  latitude = 27.7477,
  longitude = -97.4015,
  address_line = 'Port of Corpus Christi Industrial Zone',
  city = 'Corpus Christi',
  state_province = 'TX',
  country = 'US',
  location_type = 'precise'
WHERE name ILIKE '%Gulf Coast%Waste%Energy%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- Great Lakes WtE — Gary, IN
UPDATE assets SET
  latitude = 41.5934,
  longitude = -87.3464,
  city = 'Gary',
  state_province = 'IN',
  country = 'US',
  location_type = 'city'
WHERE name ILIKE '%Great Lakes%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- SkyBridge Aviation — portfolio, not location-specific
UPDATE assets SET
  country = 'US',
  location_type = 'country'
WHERE name ILIKE '%SkyBridge%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- AeroNode Drone Data Centers — West Texas pilot site
UPDATE assets SET
  latitude = 31.4506,
  longitude = -103.5059,
  city = 'Pecos',
  state_province = 'TX',
  country = 'US',
  location_type = 'precise'
WHERE name ILIKE '%AeroNode%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- Meridian Autonomous Logistics — Austin, TX
UPDATE assets SET
  latitude = 30.2672,
  longitude = -97.7431,
  city = 'Austin',
  state_province = 'TX',
  country = 'US',
  location_type = 'city'
WHERE name ILIKE '%Meridian%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- Minneapolis HQ
UPDATE assets SET
  latitude = 44.9537,
  longitude = -93.3575,
  address_line = '5245 Wayzata Blvd',
  city = 'Minneapolis',
  state_province = 'MN',
  country = 'US',
  location_type = 'precise'
WHERE name ILIKE '%Minneapolis%HQ%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- London Office
UPDATE assets SET
  latitude = 51.5136,
  longitude = -0.0943,
  city = 'London',
  country = 'GB',
  location_type = 'city'
WHERE name ILIKE '%London%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- CleanGrid Battery Storage — Bastrop County, TX
UPDATE assets SET
  latitude = 30.1102,
  longitude = -97.3150,
  city = 'Bastrop',
  state_province = 'TX',
  country = 'US',
  location_type = 'precise'
WHERE name ILIKE '%CleanGrid%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- IP Framework — no physical location
UPDATE assets SET
  location_type = 'unlocated'
WHERE name ILIKE '%IP%Valuation%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';

-- Executive Fleet — Minneapolis (same as HQ)
UPDATE assets SET
  latitude = 44.9537,
  longitude = -93.3575,
  city = 'Minneapolis',
  state_province = 'MN',
  country = 'US',
  location_type = 'city'
WHERE name ILIKE '%Executive%Fleet%'
  AND organization_id = 'd0000000-0000-0000-0000-000000000001';
