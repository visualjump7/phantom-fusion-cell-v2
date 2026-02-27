-- Seed 6 new assets (5 business, 1 family)
INSERT INTO assets (id, organization_id, name, category, estimated_value, description) VALUES
  ('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Solar Projects Portfolio', 'business', 85000000, 'Utility-scale solar installations across TX and AZ'),
  ('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'AI Data Center', 'business', 150000000, 'Tier IV AI/ML compute facility'),
  ('a0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Dallas Home', 'family', 4200000, 'Primary residence in Dallas, TX'),
  ('a0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'North Texas Real Estate', 'business', 120000000, 'Commercial and residential properties across North TX'),
  ('a0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Puerto Rico Real Estate', 'business', 65000000, 'Commercial and vacation properties in Puerto Rico'),
  ('a0000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Solar Power Operations', 'business', 45000000, 'Solar energy generation and distribution operations')
ON CONFLICT (id) DO NOTHING;
