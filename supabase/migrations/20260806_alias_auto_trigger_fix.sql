-- Fix alias auto-trigger: split BEFORE (set alias_code) from AFTER (insert alias_registry).
-- The original single BEFORE trigger tried to INSERT into alias_registry before the unit
-- row existed, violating alias_registry_unit_id_fkey.

-- ── BEFORE INSERT: generate and stamp alias_code only ───────────────────────
CREATE OR REPLACE FUNCTION public.auto_assign_alias()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tag      CHAR(2);
  v_zone_pad TEXT;
  v_seq      INTEGER;
BEGIN
  IF NEW.zone_code IS NULL OR NEW.alias_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT zone_tag INTO v_tag
  FROM public.alias_zone_tags
  WHERE zone_code = NEW.zone_code;

  IF v_tag IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.alias_zone_counters (zone_code, next_seq)
  VALUES (NEW.zone_code, 1)
  ON CONFLICT (zone_code) DO NOTHING;

  SELECT next_seq INTO v_seq
  FROM public.alias_zone_counters
  WHERE zone_code = NEW.zone_code
  FOR UPDATE;

  UPDATE public.alias_zone_counters
  SET next_seq = next_seq + 1
  WHERE zone_code = NEW.zone_code;

  v_zone_pad := LPAD(RIGHT(NEW.zone_code::TEXT, 2), 2, '0');
  NEW.alias_code := v_tag || v_zone_pad || '-' || LPAD(v_seq::TEXT, 3, '0');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_alias ON public.units;
CREATE TRIGGER trg_unit_alias
  BEFORE INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_alias();

-- ── AFTER INSERT: register alias now that the unit row exists ────────────────
CREATE OR REPLACE FUNCTION public.auto_register_alias()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.alias_code IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.alias_registry (alias_code, unit_id, zone_code, zone_index)
  VALUES (
    NEW.alias_code,
    NEW.id,
    NEW.zone_code,
    (SELECT next_seq - 1 FROM public.alias_zone_counters WHERE zone_code = NEW.zone_code)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_alias_register ON public.units;
CREATE TRIGGER trg_unit_alias_register
  AFTER INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_register_alias();
