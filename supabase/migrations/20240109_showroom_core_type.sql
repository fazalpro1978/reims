-- Add Showroom as a standalone Commercial Core Type
INSERT INTO cr_property_type_configs
  (type_code, core_type, sub_type, configuration, integration_scenario, features, category)
VALUES
  ('SH','Showroom','Automotive Showroom',  'Car Dealership',     'Automotive Strip / Boulevard', 'Purpose-built car dealership showroom with display floor, service bay access and customer lounge.', 'C'),
  ('SF','Showroom','Furniture Showroom',   'Large Format',       'Furniture & Home Retail Strip', 'Large-format ground-level showroom for furniture, home décor and interiors retail.', 'C'),
  ('SE','Showroom','Electronics Showroom', 'Branded Outlet',     'Tech & Electronics District',  'Branded electronics and technology showroom with demo areas and after-sales counter.', 'C'),
  ('SK','Showroom','Fashion Showroom',     'Boutique / Studio',  'Fashion & Lifestyle Strip',    'Boutique-style fashion showroom or trade studio for wholesale buyers and retail customers.', 'C'),
  ('SG','Showroom','General Showroom',     'Open Format',        'Mixed Commercial Strip',       'Flexible open-plan showroom suitable for any product category or trade display use.', 'C'),
  ('SM','Showroom','Mixed Use Showroom',   'Showroom + Office',  'Commercial Mixed Use',         'Showroom on ground level with integrated back-office or mezzanine workspace above.', 'C')
ON CONFLICT (type_code) DO NOTHING;
