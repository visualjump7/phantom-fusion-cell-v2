-- ============================================
-- FUSION CELL: Traust Structured LLC â€” Demo Seed
-- Run in Supabase SQL Editor
-- Idempotent: safe to rerun (ON CONFLICT DO NOTHING)
-- ============================================

-- ============================================
-- 1. ORGANIZATION
-- ============================================

INSERT INTO organizations (id, name, slug) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Traust Structured LLC', 'traust-structured')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. CLIENT PROFILE
-- ============================================

INSERT INTO client_profiles (organization_id, display_name, status, accent_color, primary_contact_name, primary_contact_email, allowed_categories)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'Traust Structured LLC',
  'active',
  'blue',
  'Drew Holt',
  'drew@trauststructured.com',
  ARRAY['business']
)
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================
-- 3. ORGANIZATION MEMBER (link admin user)
-- ============================================

INSERT INTO organization_members (organization_id, user_id, role, status)
SELECT 'd0000000-0000-0000-0000-000000000001', id, 'admin', 'active'
FROM profiles
WHERE email = 'media@phantomservices.com'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================
-- 4. NEW EXPENSE CATEGORIES (global, reusable)
-- ============================================

INSERT INTO expense_categories (id, name, color, icon) VALUES
  ('ec000000-0000-0000-0000-000000000020', 'Construction & Development', '#f59e0b', 'hard-hat'),
  ('ec000000-0000-0000-0000-000000000021', 'Personnel & Staffing',      '#3b82f6', 'users'),
  ('ec000000-0000-0000-0000-000000000022', 'Technology & Infrastructure','#8b5cf6', 'cpu'),
  ('ec000000-0000-0000-0000-000000000023', 'Consulting & Advisory',     '#14b8a6', 'briefcase'),
  ('ec000000-0000-0000-0000-000000000024', 'Travel & Logistics',        '#f97316', 'plane'),
  ('ec000000-0000-0000-0000-000000000025', 'Rent & Facilities',         '#64748b', 'building'),
  ('ec000000-0000-0000-0000-000000000026', 'Due Diligence & Valuation', '#a855f7', 'search'),
  ('ec000000-0000-0000-0000-000000000027', 'Regulatory & Permitting',   '#ef4444', 'file-check'),
  ('ec000000-0000-0000-0000-000000000028', 'Marketing & Business Dev',  '#22c55e', 'megaphone'),
  ('ec000000-0000-0000-0000-000000000029', 'Interest & Financing',      '#dc2626', 'percent')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. ASSETS (10 Business Projects)
-- ============================================

INSERT INTO assets (id, organization_id, name, category, estimated_value, identifier, description) VALUES
  ('da000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Gulf Coast Waste-to-Energy Facility',  'business', 285000000, 'WTE-GC-001',    '450 MW waste-to-energy plant under development in Corpus Christi, TX. Phase 1 construction active. Traust-structured IP-backed financing of $180M secured. Joint venture with municipal waste authority. Projected operational date Q3 2027.'),
  ('da000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Great Lakes WtE Processing Hub',       'business', 340000000, 'WTE-GL-002',    '600 MW waste-to-energy facility in Gary, IN. Pre-construction phase. Environmental impact assessment complete. Financing structure in negotiation with three institutional investors. Pipeline deal valued at $340M.'),
  ('da000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'SkyBridge Aviation Portfolio',         'business', 450000000, 'AVN-SB-001',    'Structured aviation financing portfolio. 12 active aircraft-as-collateral transactions across regional carriers and charter operators. IP-backed insurance structures on aircraft maintenance data and route optimization algorithms. Pipeline includes 6 additional pending transactions.'),
  ('da000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'AeroNode Drone Data Center Network',   'business',  95000000, 'TECH-AN-001',   'Emerging technology venture: network of autonomous drone-serviced edge data centers. Three pilot installations operational in rural broadband dead zones (West Texas, Montana, Upper Peninsula MI). Traust holds IP collateral position on proprietary drone logistics and thermal management patents. Series B financing structured at $42M.'),
  ('da000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'Meridian Autonomous Logistics Platform','business',  72000000, 'TECH-ML-001',   'IP-backed financing for autonomous last-mile delivery platform. 14 patents covering sensor fusion, route optimization, and fleet coordination. Traust structured $35M in debt financing against the patent portfolio. Platform operational in 3 metro areas with expansion planned.'),
  ('da000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'Minneapolis Corporate HQ',             'business',   8500000, 'RE-MNHQ-001',   'Corporate headquarters at 5245 Wayzata Blvd, Minneapolis, MN. 12,000 sq ft Class A office space. Houses executive team, deal structuring, and operations. Lease renewed through 2029.'),
  ('da000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', 'London Insurance Market Office',       'business',   3200000, 'RE-LDN-001',    'UK operations office for Traust Structured Limited. Located in the City of London financial district. Hub for Lloyd''s of London relationships, collateral protection insurance structuring, and European deal origination. 4,500 sq ft.'),
  ('da000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000001', 'Traust IP & Valuation Framework',      'business',  18000000, 'IP-TVF-001',    'Proprietary intangible asset valuation methodology, structured finance models, and collateral insurance frameworks developed over 8+ years. Includes proprietary scoring algorithms, risk transfer models, and the expert evaluator network platform (140+ specialists). Core competitive moat.'),
  ('da000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000001', 'Executive Travel & Corporate Fleet',   'business',   2800000, 'FLEET-EX-001',  'Corporate vehicle fleet and executive travel program. 4 executive vehicles, fractional jet card membership (NetJets QS), and travel management infrastructure for deal team mobility across US and UK operations.'),
  ('ta000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', 'CleanGrid Battery Storage Initiative', 'business', 125000000, 'ENERGY-CG-001', 'Large-scale battery energy storage system (BESS) project. Three sites across ERCOT grid (Texas). Traust providing IP-backed financing for proprietary battery management software and grid optimization algorithms. Combined capacity 200 MWh. Construction starts Q2 2026.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. BUDGETS (2026) â€” 5 key projects
-- ============================================

-- 6a. Gulf Coast WtE â€” $42M annual
INSERT INTO budgets (id, asset_id, organization_id, year) VALUES
  ('db000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 2026)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_line_items (budget_id, expense_category_id, description, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, annual_total) VALUES
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000020', 'Bechtel EPC â€” Phase 1 Construction',  1500000, 1500000, 1500000, 2000000, 2200000, 2500000, 3000000, 3200000, 3500000, 3000000, 2300000, 1800000, 28000000),
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000012', 'Environmental & Regulatory Counsel',   450000,  400000,  380000,  350000,  320000,  280000,  200000,  180000,  160000,  160000,  160000,  160000,  3200000),
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000006', 'Builder''s Risk & Liability Insurance', 700000,       0,       0,  700000,       0,       0,  700000,       0,       0,  700000,       0,       0,  2800000),
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000023', 'Burns & McDonnell Engineering',        200000,  200000,  200000,  200000,  200000,  200000,  200000,  200000,  200000,  200000,  200000,  200000,  2400000),
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000027', 'TCEQ Permits & EPA Compliance',        400000,  350000,  350000,  200000,  150000,  100000,   50000,   50000,   50000,   25000,   50000,   25000,  1800000),
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000021', 'Site Personnel & Project Staff',       175000,  175000,  180000,  185000,  185000,  190000,  195000,  195000,  190000,  185000,  175000,  170000,  2200000),
('db000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000022', 'SCADA & Emissions Monitoring',          50000,   50000,   80000,  150000,  200000,  250000,  280000,  250000,  150000,   60000,   40000,   40000,  1600000);

-- 6b. SkyBridge Aviation â€” $8.5M annual
INSERT INTO budgets (id, asset_id, organization_id, year) VALUES
  ('db000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 2026)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_line_items (budget_id, expense_category_id, description, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, annual_total) VALUES
('db000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000026', 'Fleet & Carrier Valuations',          500000,  400000,  450000,  200000,  150000,  150000,  400000,  350000,  300000,  100000,  100000,  100000,  3200000),
('db000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000012', 'Condon & Forsyth Aviation Law',       175000,  175000,  175000,  175000,  175000,  175000,  175000,  175000,  175000,  175000,  175000,  175000,  2100000),
('db000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000006', 'Aviation Portfolio Insurance',        350000,       0,       0,  350000,       0,       0,  350000,       0,       0,  350000,       0,       0,  1400000),
('db000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000023', 'Oliver Wyman Strategy',                90000,   90000,   95000,   95000,   90000,   90000,   95000,   95000,   90000,   90000,   95000,   85000,  1100000),
('db000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-000000000024', 'Carrier Site Visits & Diligence',      50000,   45000,   65000,   55000,   70000,   60000,   65000,   55000,   70000,   55000,   60000,   50000,   700000);

-- 6c. AeroNode Drone Data Centers â€” $12M annual
INSERT INTO budgets (id, asset_id, organization_id, year) VALUES
  ('db000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 2026)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_line_items (budget_id, expense_category_id, description, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, annual_total) VALUES
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000022', 'Edge Compute & Drone Fleet',          350000,  380000,  400000,  420000,  450000,  480000,  500000,  480000,  450000,  400000,  450000,  440000,  5200000),
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000021', 'Engineering & Operations Staff',      230000,  230000,  235000,  235000,  235000,  235000,  235000,  235000,  235000,  230000,  235000,  230000,  2800000),
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000020', 'Ground Station Buildout (Q3)',              0,       0,       0,   50000,  100000,  200000,  350000,  400000,  300000,  100000,       0,       0,  1500000),
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000006', 'Drone Fleet & Liability Insurance',   200000,       0,       0,  200000,       0,       0,  200000,       0,       0,  200000,       0,       0,   800000),
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000023', 'Technical Advisory Services',          75000,   75000,   75000,   75000,   75000,   75000,   75000,   75000,   75000,   75000,   75000,   75000,   900000),
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000027', 'FAA Part 107 & Airspace Compliance',   80000,   60000,   50000,   40000,   30000,   25000,   25000,   25000,   20000,   15000,   15000,   15000,   400000),
('db000000-0000-0000-0000-000000000003', 'ec000000-0000-0000-0000-000000000028', 'Go-to-Market & Business Dev',          30000,   30000,   35000,   35000,   35000,   35000,   30000,   30000,   35000,   35000,   35000,   35000,   400000);

-- 6d. Minneapolis Corporate HQ â€” $2.4M annual
INSERT INTO budgets (id, asset_id, organization_id, year) VALUES
  ('db000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 2026)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_line_items (budget_id, expense_category_id, description, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, annual_total) VALUES
('db000000-0000-0000-0000-000000000004', 'ec000000-0000-0000-0000-000000000025', 'Class A Office Lease',                90000,   90000,   90000,   90000,   90000,   90000,   90000,   90000,   90000,   90000,   90000,   90000,  1080000),
('db000000-0000-0000-0000-000000000004', 'ec000000-0000-0000-0000-000000000021', 'Office Staff & Admin',                60000,   60000,   60000,   60000,   60000,   60000,   60000,   60000,   60000,   60000,   60000,   60000,   720000),
('db000000-0000-0000-0000-000000000004', 'ec000000-0000-0000-0000-000000000022', 'IT & Cybersecurity',                  22000,   22000,   24000,   24000,   24000,   24000,   22000,   22000,   24000,   24000,   24000,   24000,   280000),
('db000000-0000-0000-0000-000000000004', 'ec000000-0000-0000-0000-000000000006', 'Property & D&O Insurance',            10000,   10000,   10000,   10000,   10000,   10000,   10000,   10000,   10000,   10000,   10000,   10000,   120000),
('db000000-0000-0000-0000-000000000004', 'ec000000-0000-0000-0000-000000000028', 'Investor Relations & Events',         15000,   15000,   18000,   18000,   18000,   18000,   15000,   15000,   18000,   18000,   18000,   14000,   200000);

-- 6e. London Insurance Market Office â€” $1.6M annual
INSERT INTO budgets (id, asset_id, organization_id, year) VALUES
  ('db000000-0000-0000-0000-000000000005', 'da000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', 2026)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_line_items (budget_id, expense_category_id, description, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, annual_total) VALUES
('db000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000025', 'Broadgate Circle Office Lease',       70000,   70000,   70000,   70000,   70000,   70000,   70000,   70000,   70000,   70000,   70000,   70000,   840000),
('db000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000021', 'UK Staff & Lloyd''s Liaison',         40000,   40000,   40000,   40000,   40000,   40000,   40000,   40000,   40000,   40000,   40000,   40000,   480000),
('db000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000024', 'Londonâ€“Minneapolis Travel',           15000,   15000,   15000,   15000,   15000,   15000,   15000,   15000,   15000,   15000,   15000,   15000,   180000),
('db000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000006', 'Professional Indemnity Insurance',     5000,    5000,    5000,    5000,    5000,    5000,    5000,    5000,    5000,    5000,    5000,    5000,    60000),
('db000000-0000-0000-0000-000000000005', 'ec000000-0000-0000-0000-000000000012', 'UK Regulatory & Companies House',      3000,    3000,    4000,    4000,    3000,    3000,    3500,    3500,    3000,    3000,    3500,    3500,    40000);

-- ============================================
-- 7. BILLS (39 across Q1â€“Q2 2026)
--    amount_cents = dollars Ã— 100
-- ============================================

INSERT INTO bills (id, organization_id, asset_id, title, amount_cents, due_date, category, payee, status) VALUES
-- Gulf Coast WtE
('dc100000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Bechtel â€” Phase 1 Payment #4',             320000000, '2026-04-01', 'Construction',  'Bechtel Corporation',         'pending'),
('dc100000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'TCEQ â€” Air Quality Permit Fee',             18500000, '2026-03-15', 'Regulatory',    'TX Commission on Env. Quality','paid'),
('dc100000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Marsh McLennan â€” Builder''s Risk Q2',       70000000, '2026-04-01', 'Insurance',     'Marsh McLennan',              'pending'),
('dc100000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Burns & McDonnell â€” Engineering March',     21000000, '2026-03-30', 'Engineering',   'Burns & McDonnell',           'paid'),
('dc100000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Bechtel â€” Phase 1 Payment #5',             350000000, '2026-05-01', 'Construction',  'Bechtel Corporation',         'pending'),
('dc100000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Environmental Consultants â€” EIA Review',     9500000, '2026-04-15', 'Consulting',    'Environmental Consultants LLC','pending'),
('dc100000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Texas DOT â€” Road Use Permit',                4500000, '2026-03-05', 'Regulatory',    'Texas DOT',                   'paid'),

-- SkyBridge Aviation
('dc100000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'Condon & Forsyth â€” Legal (Delta Charter)',  14500000, '2026-03-20', 'Legal',         'Condon & Forsyth LLP',        'paid'),
('dc100000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'MBA â€” Fleet Valuation Report',               8500000, '2026-04-15', 'Consulting',    'mba Aviation',                'pending'),
('tb100000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'Lloyd''s Syndicate 4020 â€” CPI',             35000000, '2026-04-01', 'Insurance',     'Lloyd''s of London',          'pending'),
('tb100000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'AerCap Holdings â€” Aircraft Lease Q2',      120000000, '2026-04-01', 'Lease',         'AerCap Holdings N.V.',        'pending'),
('tb100000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'Willis Towers Watson â€” Aviation Ins. Q2',   28000000, '2026-04-15', 'Insurance',     'Willis Towers Watson',        'pending'),
('tb100000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'Oliver Wyman â€” Market Analysis',            12000000, '2026-05-01', 'Consulting',    'Oliver Wyman',                'pending'),

-- AeroNode Drone Data Centers
('tb100000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'Skydio â€” Drone Fleet (12 units)',           42000000, '2026-03-25', 'Equipment',     'Skydio Inc.',                 'paid'),
('tb100000-0000-0000-0000-000000000015', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'AWS GovCloud â€” Edge Computing Q1',           9200000, '2026-03-31', 'Technology',    'Amazon Web Services',         'pending'),
('tb100000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'FAA â€” Part 107 Waiver Fee',                  1250000, '2026-04-10', 'Regulatory',    'Federal Aviation Admin.',     'pending'),
('tb100000-0000-0000-0000-000000000017', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'NVIDIA â€” GPU Compute Modules (Batch 3)',    38500000, '2026-04-20', 'Equipment',     'NVIDIA Corporation',          'pending'),
('tb100000-0000-0000-0000-000000000018', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'Verizon Business â€” 5G Connectivity Q2',      6500000, '2026-04-01', 'Technology',    'Verizon Business',            'pending'),
('tb100000-0000-0000-0000-000000000019', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'Morrison & Foerster â€” IP Counsel Q1',       17500000, '2026-03-31', 'Legal',         'Morrison & Foerster LLP',     'paid'),

-- Meridian Autonomous Logistics
('tb100000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000005', 'Waymo â€” Sensor Fusion Library License',     27500000, '2026-04-01', 'Technology',    'Waymo LLC',                   'pending'),
('tb100000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000005', 'Velodyne Lidar â€” Sensor Procurement',      18500000, '2026-04-15', 'Equipment',     'Velodyne Lidar Inc.',         'pending'),

-- Minneapolis Corporate HQ
('tb100000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000006', 'Cushman & Wakefield â€” Lease April',         9000000, '2026-04-01', 'Rent',          'Cushman & Wakefield',         'pending'),
('tb100000-0000-0000-0000-000000000023', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000006', 'Arctic Wolf â€” Cybersecurity Annual',         4800000, '2026-03-15', 'Technology',    'Arctic Wolf Networks',        'paid'),
('tb100000-0000-0000-0000-000000000024', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000006', 'Cushman & Wakefield â€” Lease May',           9000000, '2026-05-01', 'Rent',          'Cushman & Wakefield',         'pending'),
('tb100000-0000-0000-0000-000000000025', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000006', 'Deloitte â€” Q1 Audit Services',             12500000, '2026-04-30', 'Professional',  'Deloitte LLP',                'pending'),
('tb100000-0000-0000-0000-000000000026', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000006', 'Comcast Business â€” Internet & Phones',       450000, '2026-04-01', 'Utilities',     'Comcast Business',            'pending'),

-- London Insurance Market Office
('tb100000-0000-0000-0000-000000000027', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000007', 'British Land â€” Q2 Lease',                  16500000, '2026-04-01', 'Rent',          'British Land PLC',            'pending'),
('tb100000-0000-0000-0000-000000000028', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000007', 'Hiscox â€” Professional Indemnity',            2800000, '2026-03-20', 'Insurance',     'Hiscox Ltd',                  'paid'),
('tb100000-0000-0000-0000-000000000029', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000007', 'DLA Piper UK â€” Regulatory Filing',          3500000, '2026-04-30', 'Legal',         'DLA Piper UK LLP',            'pending'),
('tb100000-0000-0000-0000-000000000030', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000007', 'British Land â€” Q3 Lease',                  16500000, '2026-07-01', 'Rent',          'British Land PLC',            'pending'),

-- CleanGrid Battery Storage
('tb100000-0000-0000-0000-000000000031', 'd0000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000010', 'Tesla Energy â€” Megapack Deposit (Site 1)', 450000000, '2026-04-15', 'Equipment',     'Tesla Energy',                'pending'),
('tb100000-0000-0000-0000-000000000032', 'd0000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000010', 'ERCOT â€” Interconnection Fee',                7500000, '2026-03-10', 'Regulatory',    'ERCOT',                       'paid'),
('tb100000-0000-0000-0000-000000000033', 'd0000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000010', 'Black & Veatch â€” Engineering Design',      32000000, '2026-05-15', 'Engineering',   'Black & Veatch',              'pending'),
('tb100000-0000-0000-0000-000000000034', 'd0000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000010', 'Fluor Corporation â€” Site Preparation',      85000000, '2026-06-01', 'Construction',  'Fluor Corporation',           'pending'),

-- IP & Valuation Framework
('tb100000-0000-0000-0000-000000000035', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000008', 'USPTO â€” Patent Renewal Batch',              3200000, '2026-05-01', 'Regulatory',    'US Patent & Trademark Office','pending'),
('tb100000-0000-0000-0000-000000000036', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000008', 'Knobbe Martens â€” IP Prosecution Q1',       16500000, '2026-03-28', 'Legal',         'Knobbe Martens',              'paid'),
('tb100000-0000-0000-0000-000000000037', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000008', 'Kirkland & Ellis â€” Licensing Review',       9500000, '2026-05-15', 'Legal',         'Kirkland & Ellis LLP',        'pending'),

-- Executive Travel & Corporate Fleet
('tb100000-0000-0000-0000-000000000038', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000009', 'NetJets â€” QS Card Annual',                 28000000, '2026-04-01', 'Aviation',      'NetJets Inc.',                'pending'),
('tb100000-0000-0000-0000-000000000039', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000009', 'Mercedes-Benz Financial â€” Lease Q2',        1850000, '2026-04-01', 'Fleet',         'Mercedes-Benz Financial',     'pending')

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. MESSAGES (11 executive-facing)
-- ============================================

INSERT INTO messages (id, organization_id, asset_id, type, priority, title, body, is_global) VALUES
-- Decisions
('dd000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'decision', 'high',
 'Phase 1 Contractor Change Order #7 â€” Turbine Foundation Reinforcement',
 'Your engineering team has identified soil conditions at the turbine pad that require additional reinforcement beyond original specifications. Bechtel has submitted Change Order #7 for $1.8M covering additional piling and foundation work. Your on-site PM recommends approval â€” the alternative is a 90-day construction delay estimated at $4.2M in carrying costs. We recommend approval with a condition that Bechtel absorb 15% of the overage per the original contract''s unforeseen conditions clause.',
 false),

('dd000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'decision', 'high',
 'New Transaction â€” Horizon Air Services IP-Backed Facility',
 'Your deal team has completed due diligence on Horizon Air Services, a Part 135 operator with 8 aircraft and proprietary scheduling/maintenance software. Proposed structure: $12M IP-backed facility secured by their software IP and maintenance data assets, 36-month term, 8.2% rate. Collateral protection insurance quoted at 2.1% through Lloyd''s. Deal team recommends proceeding. Attached: term sheet summary and IP valuation report.',
 false),

('dd000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000010', 'decision', 'urgent',
 'ERCOT Interconnection Agreement â€” Site 1 Final Terms',
 'ERCOT has returned final interconnection terms for the Bastrop County site. Key change from draft: required $2.4M transmission upgrade contribution (up from $1.8M estimate). Your energy counsel advises this is within market range for 75MW BESS projects in ERCOT. Timeline: sign by April 30 or lose queue position. We recommend approval.',
 false),

('dd000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'decision', 'high',
 'Series B Lead Investor Term Sheet â€” Andreessen Horowitz',
 'a16z has submitted a term sheet for AeroNode''s Series B at $42M on a $95M pre-money valuation. Key terms: a16z takes one board seat, standard protective provisions, pro-rata rights. Your IP collateral position would be subordinated to the new equity but remains protected by the insurance structure. Legal has reviewed and flagged two provisions for negotiation. We recommend accepting with modifications to the board observer rights clause.',
 false),

-- Action Required
('dd000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000008', 'action_required', 'medium',
 'Patent Portfolio â€” 3 Patents Approaching Maintenance Deadline',
 'Three patents in the valuation methodology portfolio have maintenance fees due May 1. US Patent Nos. 11,234,567 (asset scoring algorithm), 11,345,678 (risk transfer model), and 11,456,789 (collateral insurance framework). Combined renewal cost: $32,000. All three are core to the valuation framework â€” we recommend renewal.',
 false),

('dd000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000007', 'action_required', 'medium',
 'UK Companies House Annual Confirmation Statement Due',
 'The annual confirmation statement for Traust Structured Limited is due April 14. Your UK compliance team has prepared the filing. We need your authorization to submit. No changes to registered details from last year.',
 false),

-- Alerts
('dd000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'alert', 'low',
 'TCEQ Inspection Scheduled â€” April 8',
 'Texas Commission on Environmental Quality has scheduled a routine inspection of the Gulf Coast facility construction site for April 8. Your environmental compliance team has been notified and is preparing documentation. No action needed from you â€” this is informational. Your PM will provide a post-inspection summary.',
 false),

('dd000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'alert', 'high',
 'Portfolio Alert â€” Regional One Airlines Maintenance Default Notice',
 'Regional One Airlines, one of the 12 portfolio companies, has triggered a maintenance covenant default on their $8M facility. Specifically, they deferred a scheduled C-check by 45 days beyond the contractual window. Your collateral protection insurance has been notified. No financial exposure to Traust at this time â€” the insurance structure covers this scenario. Your deal team is in contact with Regional One management. Next update in 48 hours.',
 false),

-- Updates
('dd000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000001', NULL, 'update', 'medium',
 'Monthly Pipeline Summary â€” March 2026',
 'Pipeline update for your review. Active transactions: 12 ($450M aviation, continuing). New inbound: 3 deals totaling $85M (two SaaS companies and one biotech). Closed this month: 1 ($18M, autonomous vehicle fleet operator). Lost: 0. Total active pipeline: $4.2B across waste-to-energy and structured finance. Your deal team is prioritizing the two SaaS inbound deals for Q2 close. Full report attached.',
 true),

('tm000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000004', 'update', 'medium',
 'AeroNode â€” FAA Part 107 Waiver Approval Received',
 'The FAA has approved AeroNode''s expanded Part 107 waiver for beyond-visual-line-of-sight operations at all 12 deployment sites. This clears the regulatory path for full commercial operations starting Q2.',
 false),

('tm000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000005', 'update', 'low',
 'Meridian Autonomous Logistics â€” Q1 Operations Report',
 'DFW-to-Houston pilot corridor completed 847 autonomous miles in Q1 with zero safety incidents. Waymo sensor fusion integration ahead of schedule. Recommend expanding to I-35 corridor in Q3.',
 false)

ON CONFLICT (id) DO NOTHING;
