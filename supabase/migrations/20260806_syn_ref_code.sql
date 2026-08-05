-- ════════════════════════════════════════════════════════════════════════════
-- 20260806_syn_ref_code.sql
-- Change inquiry reference prefix from INQ-YYYYMM-NNNN → SYN-YYYY-NNNN
-- Matches Synergy Centre architecture spec (annual reset, human-readable).
-- Counter key stored as YYYY||'00' in cr_ref_counters.yyyymm (CHAR(6)).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_inquiry_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  yr   CHAR(6) := to_char(now(), 'YYYY') || '00';   -- e.g. '202600' = annual bucket
  seq  INTEGER;
BEGIN
  INSERT INTO public.cr_ref_counters (domain, yyyymm, next_seq)
  VALUES ('SYN', yr, 1)
  ON CONFLICT (domain, yyyymm) DO NOTHING;

  SELECT next_seq INTO seq
  FROM public.cr_ref_counters
  WHERE domain = 'SYN' AND yyyymm = yr
  FOR UPDATE;

  UPDATE public.cr_ref_counters
  SET next_seq = next_seq + 1
  WHERE domain = 'SYN' AND yyyymm = yr;

  NEW.ref_no := 'SYN-' || LEFT(yr, 4) || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;
