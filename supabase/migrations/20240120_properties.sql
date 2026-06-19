-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Properties module — public listings from PropertyFinder, Instagram, TikTok, and manual entry.

-- ── 1. Properties table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.properties (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no         TEXT        UNIQUE,                                -- PRP-202606-0001

  -- Classification
  title          TEXT,
  listing_type   TEXT        NOT NULL DEFAULT 'rent'
                             CHECK (listing_type IN ('rent', 'sale')),
  property_type  TEXT,                                             -- Apartment, Villa, Townhouse, …
  bedrooms       INT,                                              -- NULL = studio / commercial
  bathrooms      INT,
  size_sqm       NUMERIC,
  floor          TEXT,
  furnished      TEXT        CHECK (furnished IN ('furnished', 'semi-furnished', 'unfurnished')),

  -- Pricing
  price          NUMERIC,                                          -- monthly for rent; total for sale
  price_currency TEXT        NOT NULL DEFAULT 'QAR',

  -- Location
  location       TEXT,
  zone           TEXT,
  compound       TEXT,

  -- Content
  description    TEXT,
  images         TEXT[]      NOT NULL DEFAULT '{}',
  amenities      TEXT[]      NOT NULL DEFAULT '{}',

  -- Source
  source         TEXT        NOT NULL DEFAULT 'manual'
                             CHECK (source IN ('propertyfinder', 'instagram', 'tiktok', 'manual')),
  source_url     TEXT,
  source_ref     TEXT,                                             -- PF listing ID / social post ID

  -- Lifecycle
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'leased', 'sold', 'inactive')),
  featured       BOOLEAN     NOT NULL DEFAULT FALSE,
  synced_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint prevents duplicate synced listings
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_source_ref
  ON public.properties (source, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_status      ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_source      ON public.properties (source);
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON public.properties (listing_type);

-- ── 2. Auto ref_no trigger (PRP-YYYYMM-NNNN) ────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_property_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ym  TEXT := TO_CHAR(now(), 'YYYYMM');
  seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(ref_no, '-', 3) AS INT)), 0) + 1
    INTO seq FROM public.properties WHERE ref_no LIKE 'PRP-' || ym || '-%';
  NEW.ref_no := 'PRP-' || ym || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_ref_no ON public.properties;
CREATE TRIGGER trg_property_ref_no
  BEFORE INSERT ON public.properties
  FOR EACH ROW WHEN (NEW.ref_no IS NULL)
  EXECUTE FUNCTION public.set_property_ref_no();

-- ── 3. Auto updated_at trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_property_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_updated_at ON public.properties;
CREATE TRIGGER trg_property_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_property_updated_at();

-- ── 4. RLS & grants ──────────────────────────────────────────────────────────

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.properties;
CREATE POLICY "service_role full access" ON public.properties
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "authenticated read" ON public.properties;
CREATE POLICY "authenticated read" ON public.properties
  FOR SELECT TO authenticated, anon USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO service_role;
GRANT SELECT ON public.properties TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_property_ref_no    TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_property_updated_at TO service_role, authenticated, anon;
