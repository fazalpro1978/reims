-- Seed generic Master Code type_codes into cr_property_type_configs.
-- These are building-level codes (no unit Config) used exclusively by Master Code entries.
-- Unit-level codes (2B, ST, OP, etc.) remain unchanged.

INSERT INTO public.cr_property_type_configs (type_code, configuration, category)
VALUES
  ('AP', 'Master — Residential Apartment', 'R'),
  ('VI', 'Master — Residential Villa',     'R')
ON CONFLICT (type_code) DO NOTHING;

-- Dynamic additions via the Code Registry admin UI call POST /api/code-registry/type-configs
-- and insert directly into this table. No further migration needed for new types added via UI.
