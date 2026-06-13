-- ─────────────────────────────────────────────────────────────────────────────
-- Commercial Property Types Seed
-- Run AFTER 20240108_smart_code_category.sql (requires the category column)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO cr_property_type_configs
  (type_code, core_type, sub_type, configuration, integration_scenario, features, category)
VALUES

  -- ── Office ────────────────────────────────────────────────────────────────
  ('OO','Office','Open Plan Office',   'Open Layout',       'Business Tower / Commercial Hub',  'Flexible open-plan workspace suitable for SMEs and corporates.', 'C'),
  ('OP','Office','Partitioned Office', 'Partitioned Layout','Business Tower / Commercial Hub',  'Pre-divided private office rooms within a shared floor.', 'C'),
  ('OE','Office','Executive Suite',    'Fitted Suite',      'Premium Grade-A Tower',            'Fully fitted, serviced executive office with reception and meeting room.', 'C'),
  ('OC','Office','Co-working Space',   'Shared Desk',       'Managed Flexible Workspace',       'Hot-desking and private pod options in a managed environment.', 'C'),
  ('OB','Office','Business Centre',    'Full Floor',        'Premium Grade-A Tower',            'Full floor tenancy in a managed business centre with shared amenities.', 'C'),

  -- ── Retail ────────────────────────────────────────────────────────────────
  ('RG','Retail','Ground Floor Retail','Street Facing',     'Mixed-Use Commercial Podium',      'High-visibility street-level unit with direct pedestrian access.', 'C'),
  ('RM','Retail','Mall Unit',          'Inline Unit',       'Enclosed Shopping Mall',           'Standard inline retail unit within a climate-controlled shopping mall.', 'C'),
  ('RA','Retail','Mall Unit',          'Anchor / Corner',   'Enclosed Shopping Mall',           'Premium high-footfall corner or anchor position within a shopping mall.', 'C'),
  ('RS','Retail','Showroom',           'Large Format',      'Automotive / Furniture Strip',     'Large-format ground-level showroom suited for automotive, furniture or electronics.', 'C'),
  ('RF','Retail','F&B Unit',           'Restaurant / Café', 'F&B Strip / Food Court',          'Dedicated food and beverage unit with extraction and grease-trap provisions.', 'C'),
  ('RK','Retail','Kiosk',              'Standalone Kiosk',  'Mall Concourse / Open Area',       'Compact standalone kiosk in a high-footfall concourse or atrium position.', 'C'),

  -- ── Warehouse / Industrial ────────────────────────────────────────────────
  ('WS','Warehouse','Standard Warehouse',       'Open Bay',        'Industrial Zone / Logistics Park', 'Single or multi-bay open warehouse with loading dock access.', 'C'),
  ('WT','Warehouse','Temperature Controlled',   'Cold Store',      'Logistics & Cold Chain Facility',  'Refrigerated or frozen storage unit for perishable goods.', 'C'),
  ('WL','Warehouse','Light Industrial',         'Workshop / Unit', 'Industrial Estate',                'Combined office-and-workshop unit for light manufacturing or trade.', 'C'),
  ('WM','Warehouse','Mixed Use Industrial',     'Showroom + Store', 'Commercial Industrial',           'Ground-level showroom fronting a rear storage warehouse on the same title.', 'C'),

  -- ── Labour Camp ───────────────────────────────────────────────────────────
  ('LC','Labour Camp','Labour Accommodation', 'Standard Block', 'Industrial Zone / Labour City', 'Purpose-built staff accommodation blocks with shared facilities.', 'C'),
  ('LP','Labour Camp','Labour Accommodation', 'Premium Block',  'Corporate Labour Village',      'Higher-standard staff accommodation with enhanced welfare facilities.', 'C'),

  -- ── Commercial Villa ──────────────────────────────────────────────────────
  ('CV','Commercial Villa','Business Villa', 'Standalone',      'Commercial Villa District',  'Standalone villa plot converted or purpose-built for commercial office use.', 'C'),
  ('CM','Commercial Villa','Mixed Use Villa','Ground + Upper',  'Mixed Commercial Residential','Ground floor commercial with upper residential or office floors.', 'C'),

  -- ── Land ──────────────────────────────────────────────────────────────────
  ('CL','Land','Commercial Land',    'Bare Plot',        'Commercial Development Zone',  'Zoned commercial plot available for development or investment.', 'C'),
  ('IL','Land','Industrial Land',    'Bare Plot',        'Industrial Development Zone',  'Zoned industrial plot for factory, warehouse or logistics development.', 'C'),
  ('ML','Land','Mixed Use Land',     'Bare Plot',        'Master-Planned Mixed Zone',    'Dual-zoned plot permitting both commercial and residential development.', 'C'),

  -- ── Hospitality / Hotel ───────────────────────────────────────────────────
  ('HT','Hospitality','Hotel Room',      'Standard Room',    'Full-Service Hotel',          'Individual hotel room unit within a full-service hospitality establishment.', 'C'),
  ('HS','Hospitality','Hotel Suite',     'Executive Suite',  'Full-Service Hotel',          'Premium hotel suite with separate living and sleeping areas.', 'C'),
  ('HB','Hospitality','Hotel Apartment', 'Studio',           'Apart-Hotel / Serviced Block', 'Hotel-apartment unit operated under a hospitality licence for short stays.', 'C'),
  ('HC','Hospitality','Hotel Apartment', '1 BHK',            'Apart-Hotel / Serviced Block', 'One-bedroom hotel-apartment within a commercially licenced serviced block.', 'C')

ON CONFLICT (type_code) DO NOTHING;
