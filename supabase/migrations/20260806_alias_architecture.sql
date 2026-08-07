-- ════════════════════════════════════════════════════════════════════════════
-- 20260806_alias_architecture.sql
-- Unified Reference Code Standard — v3.0
--
-- Changes:
--   1. cr_ref_counters — race-condition-free counter for INQ / PRP / CTR refs
--   2. Rewired set_inquiry_ref_no() and set_property_ref_no() to use it
--   3. New set_contract_ref_no() + trigger (CTR-YYYYMM-NNNN)
--   4. alias_zone_tags  — zone_code → 2-char tag + human label
--   5. alias_zone_counters + alias_next_seq() — atomic per-zone counter
--   6. alias_registry   — alias_code → unit_id (one alias per unit)
--   7. alias_resolution_log — admin audit trail
--   8. units.alias_code nullable column (cached, populated lazily)
--   9. contracts.ref_no column (CTR-YYYYMM-NNNN)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. cr_ref_counters ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cr_ref_counters (
  domain    CHAR(3)  NOT NULL,
  yyyymm    CHAR(6)  NOT NULL,
  next_seq  INTEGER  NOT NULL DEFAULT 1,
  PRIMARY KEY (domain, yyyymm)
);

GRANT ALL ON public.cr_ref_counters TO service_role, authenticated, anon;

-- ── 2. Rewrite set_inquiry_ref_no() — uses cr_ref_counters with FOR UPDATE ──

CREATE OR REPLACE FUNCTION public.set_inquiry_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ym  CHAR(6) := to_char(now(), 'YYYYMM');
  seq INTEGER;
BEGIN
  INSERT INTO public.cr_ref_counters (domain, yyyymm, next_seq)
  VALUES ('INQ', ym, 1)
  ON CONFLICT (domain, yyyymm) DO NOTHING;

  SELECT next_seq INTO seq
  FROM public.cr_ref_counters
  WHERE domain = 'INQ' AND yyyymm = ym
  FOR UPDATE;

  UPDATE public.cr_ref_counters
  SET next_seq = next_seq + 1
  WHERE domain = 'INQ' AND yyyymm = ym;

  NEW.ref_no := 'INQ-' || ym || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- ── 3. Rewrite set_property_ref_no() — same pattern ─────────────────────────

CREATE OR REPLACE FUNCTION public.set_property_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ym  CHAR(6) := to_char(now(), 'YYYYMM');
  seq INTEGER;
BEGIN
  INSERT INTO public.cr_ref_counters (domain, yyyymm, next_seq)
  VALUES ('PRP', ym, 1)
  ON CONFLICT (domain, yyyymm) DO NOTHING;

  SELECT next_seq INTO seq
  FROM public.cr_ref_counters
  WHERE domain = 'PRP' AND yyyymm = ym
  FOR UPDATE;

  UPDATE public.cr_ref_counters
  SET next_seq = next_seq + 1
  WHERE domain = 'PRP' AND yyyymm = ym;

  NEW.ref_no := 'PRP-' || ym || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- ── 4. Contracts ref_no column + CTR trigger ─────────────────────────────────

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS ref_no TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.set_contract_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ym  CHAR(6) := to_char(now(), 'YYYYMM');
  seq INTEGER;
BEGIN
  INSERT INTO public.cr_ref_counters (domain, yyyymm, next_seq)
  VALUES ('CTR', ym, 1)
  ON CONFLICT (domain, yyyymm) DO NOTHING;

  SELECT next_seq INTO seq
  FROM public.cr_ref_counters
  WHERE domain = 'CTR' AND yyyymm = ym
  FOR UPDATE;

  UPDATE public.cr_ref_counters
  SET next_seq = next_seq + 1
  WHERE domain = 'CTR' AND yyyymm = ym;

  NEW.ref_no := 'CTR-' || ym || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_ref_no ON public.contracts;
CREATE TRIGGER trg_contract_ref_no
  BEFORE INSERT ON public.contracts
  FOR EACH ROW WHEN (NEW.ref_no IS NULL)
  EXECUTE FUNCTION public.set_contract_ref_no();

-- ── 5. alias_zone_tags ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_zone_tags (
  zone_code   INTEGER   PRIMARY KEY,
  zone_tag    CHAR(2)   NOT NULL UNIQUE,
  zone_label  TEXT      NOT NULL
);

GRANT ALL ON public.alias_zone_tags TO service_role, authenticated, anon;

INSERT INTO public.alias_zone_tags (zone_code, zone_tag, zone_label) VALUES
  (4,  'MB', 'Musheireb'),
  (32, 'MN', 'Madinat Khalifa North'),
  (33, 'AM', 'Al Markhiya'),
  (34, 'MS', 'Madinat Khalifa South'),
  (38, 'AS', 'Al Sadd'),
  (39, 'SA', 'Al Sadd / New Mirqab'),
  (52, 'MH', 'Muaither'),
  (53, 'AW', 'Al Waab'),
  (60, 'DF', 'Al Dafna'),
  (61, 'WB', 'West Bay'),
  (69, 'LS', 'Lusail'),
  (71, 'US', 'Umm Salal'),
  (72, 'SN', 'Al Shahaniya'),
  (74, 'KH', 'Al Khor'),
  (90, 'WK', 'Al Wakrah')
ON CONFLICT (zone_code) DO NOTHING;

-- ── 6. alias_zone_counters + alias_next_seq() ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_zone_counters (
  zone_code  INTEGER  PRIMARY KEY,
  next_seq   INTEGER  NOT NULL DEFAULT 1
);

GRANT ALL ON public.alias_zone_counters TO service_role;

CREATE OR REPLACE FUNCTION public.alias_next_seq(p_zone_code INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_seq INTEGER;
BEGIN
  INSERT INTO public.alias_zone_counters (zone_code, next_seq)
  VALUES (p_zone_code, 1)
  ON CONFLICT (zone_code) DO NOTHING;

  SELECT next_seq INTO v_seq
  FROM public.alias_zone_counters
  WHERE zone_code = p_zone_code
  FOR UPDATE;

  UPDATE public.alias_zone_counters
  SET next_seq = next_seq + 1
  WHERE zone_code = p_zone_code;

  RETURN v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.alias_next_seq(INTEGER) TO service_role;

-- ── 7. alias_registry ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_registry (
  alias_code   CHAR(8)       PRIMARY KEY,
  unit_id      UUID          NOT NULL UNIQUE REFERENCES public.units(id) ON DELETE CASCADE,
  zone_code    INTEGER       NOT NULL,
  zone_index   INTEGER       NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by   UUID          REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_alias_registry_unit  ON public.alias_registry (unit_id);
CREATE INDEX IF NOT EXISTS idx_alias_registry_zone  ON public.alias_registry (zone_code);

ALTER TABLE public.alias_registry
  ADD CONSTRAINT fk_alias_registry_zone_tag
  FOREIGN KEY (zone_code) REFERENCES public.alias_zone_tags(zone_code);

GRANT SELECT ON public.alias_registry TO authenticated, anon;
GRANT ALL    ON public.alias_registry TO service_role;

-- ── 8. alias_resolution_log ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alias_resolution_log (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_code   CHAR(8)       NOT NULL REFERENCES public.alias_registry(alias_code),
  resolved_by  UUID          REFERENCES auth.users(id),
  resolved_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  context      TEXT
);

CREATE INDEX IF NOT EXISTS idx_alias_log_code ON public.alias_resolution_log (alias_code);
CREATE INDEX IF NOT EXISTS idx_alias_log_who  ON public.alias_resolution_log (resolved_by);

GRANT ALL ON public.alias_resolution_log TO service_role;

-- ── 9. units.alias_code cached column ────────────────────────────────────────

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS alias_code CHAR(8) UNIQUE;

-- Grants on existing tables stay as-is; alias_code is just a nullable column.

-- ── Done ─────────────────────────────────────────────────────────────────────
