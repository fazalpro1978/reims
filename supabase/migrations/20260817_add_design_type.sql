-- Add design_type column to units table.
-- Stores layout variant codes and special unit designations extracted by AXIOM
-- (e.g. "Type B", "Standard", "Medium", "Mock up unit", "Rowhouse").
-- Surfaced in REIMS under Classification → Unit Type as "Design Type".

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS design_type TEXT;

COMMENT ON COLUMN public.units.design_type IS
  'Layout variant or special designation extracted from leasing sheet config/status fields. Examples: "Type B", "Standard", "Medium", "Mock up unit", "Rowhouse".';
