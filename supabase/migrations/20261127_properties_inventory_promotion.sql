-- Promote inventory units into /properties listings (Demand & Readiness).

-- 1. Link + audit columns
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS unit_id        UUID,
  ADD COLUMN IF NOT EXISTS master_code    TEXT,
  ADD COLUMN IF NOT EXISTS smart_code     TEXT,
  ADD COLUMN IF NOT EXISTS contact_name   TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone  TEXT,
  ADD COLUMN IF NOT EXISTS media_link     TEXT,   -- photo / gallery / Drive folder / video link from the unit
  ADD COLUMN IF NOT EXISTS title_ar       TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS promoted_by    TEXT;

-- one listing per unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unit_id ON public.properties (unit_id) WHERE unit_id IS NOT NULL;

-- 2. Unit bathrooms can be 1.5 / 2.5
ALTER TABLE public.properties ALTER COLUMN bathrooms TYPE NUMERIC USING bathrooms::NUMERIC;

-- 3. Allow source = 'inventory'
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.properties'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source%propertyfinder%'
  LOOP
    EXECUTE format('ALTER TABLE public.properties DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_source_check CHECK (source IN ('propertyfinder','instagram','tiktok','manual','inventory'));
