-- Add nullable assigned_unit_id FK to inquiries
-- Allows agents to explicitly bind a specific unit to an inquiry post-matching.
-- ON DELETE SET NULL preserves inquiry records if the unit is removed.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS assigned_unit_id UUID
    REFERENCES public.units(id) ON DELETE SET NULL;

-- Allow the service role and authenticated roles to read/write the new column
-- (table-level GRANTs already exist from the prior migration; index only)
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_unit_id
  ON public.inquiries (assigned_unit_id)
  WHERE assigned_unit_id IS NOT NULL;
