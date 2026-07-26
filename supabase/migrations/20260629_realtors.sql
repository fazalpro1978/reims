-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Realtors module — canonical brokerage registry shared by REIMS and dInges.
-- Replaces the hardcoded REALTORS[] in components/UnitDetailsModal.tsx and the
-- "All Realtors" filter in UnitsInventory.tsx (previously just distinct
-- units.realtor_name with no MOCI ID), so both apps read one source of truth.

-- ── 1. Realtors table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.realtors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  moci_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_realtors_name_lower ON public.realtors (LOWER(name));

-- ── 2. Auto updated_at trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_realtor_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_realtor_updated_at ON public.realtors;
CREATE TRIGGER trg_realtor_updated_at
  BEFORE UPDATE ON public.realtors
  FOR EACH ROW EXECUTE FUNCTION public.set_realtor_updated_at();

-- ── 3. RLS & grants ──────────────────────────────────────────────────────────

ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.realtors;
CREATE POLICY "service_role full access" ON public.realtors
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "authenticated read" ON public.realtors;
CREATE POLICY "authenticated read" ON public.realtors
  FOR SELECT TO authenticated, anon USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtors TO service_role;
GRANT SELECT ON public.realtors TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_realtor_updated_at TO service_role, authenticated, anon;

-- ── 4. Seed: existing hardcoded list (copied verbatim from UnitDetailsModal.tsx) ─

INSERT INTO public.realtors (name, moci_id) VALUES
  ('25 Spaces Real Estate',        'MOCI-BRK-25S-0167'),
  ('ABH Real Estate',              'MOCI-BRK-ABH-0234'),
  ('Al Asmakh Real Estate',        'MOCI-BRK-ASM-0023'),
  ('Alfardan Properties',          'MOCI-REG-ALP-0045'),
  ('Al Jazi Real Estate',          'MOCI-IPM-AJZ-0089'),
  ('Al Mana Real Estate',          'MOCI-REG-ALM-0034'),
  ('Betterhomes Qatar',            'MOCI-BRK-BHQ-0067'),
  ('Capital One Real Estate',      'MOCI-BRK-CAO-0156'),
  ('Capstone Property',            'MOCI-BRK-CAP-0145'),
  ('Coreo Real Estate',            'MOCI-BRK-CRE-0134'),
  ('Corporate Real Estate Qatar',  'MOCI-BRK-CRQ-0212'),
  ('Danat Qatar',                  'MOCI-IPM-DAN-0078'),
  ('Direct Real Estate',           'MOCI-BRK-DRE-0178'),
  ('FGREALTY Qatar',               'MOCI-BRK-FGR-0056'),
  ('JMJ Group Holding',            'MOCI-REG-JMJ-0067'),
  ('Maroon Homes',                 'MOCI-BRK-MRH-0245'),
  ('Msheireb Properties',          'MOCI-REG-MSH-0001'),
  ('NelsonPark Property',          'MOCI-BRK-NPP-0112'),
  ('Premium Property Qatar',       'MOCI-BRK-PPQ-0201'),
  ('The Loft Bureau Real Estate',  'MOCI-BRK-LFT-0078'),
  ('The Pearl Gates',              'MOCI-BRK-TPG-0089'),
  ('Unicorn Real Estate',          'MOCI-BRK-UNI-0189')
ON CONFLICT (LOWER(name)) DO NOTHING;

-- ── 5. Seed: anything already live in units not covered above ───────────────

INSERT INTO public.realtors (name, moci_id)
SELECT DISTINCT realtor_name, realtor_moci
FROM public.units
WHERE realtor_name IS NOT NULL
ON CONFLICT (LOWER(name)) DO NOTHING;
