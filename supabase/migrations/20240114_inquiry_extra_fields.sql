-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Adds Buy to listing_type and three new optional inquiry fields.

-- Drop existing listing_type check constraint (auto-named by Postgres)
DO $$
DECLARE con TEXT;
BEGIN
  SELECT conname INTO con FROM pg_constraint
  WHERE conrelid = 'public.inquiries'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%listing_type%';
  IF con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.inquiries DROP CONSTRAINT ' || quote_ident(con);
  END IF;
END $$;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_listing_type_check
  CHECK (listing_type IN ('Rent','Sale','Buy'));

-- New optional fields
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS move_in_date   DATE,
  ADD COLUMN IF NOT EXISTS bills_included TEXT
    CHECK (bills_included IN ('Including','Excluding','Negotiable')),
  ADD COLUMN IF NOT EXISTS size           NUMERIC;
