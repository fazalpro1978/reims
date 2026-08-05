-- ════════════════════════════════════════════════════════════════════════════
-- 20260806_alias_auto_trigger.sql
-- Auto-generate alias_code for every new unit on INSERT.
-- Skips silently if zone_code has no entry in alias_zone_tags.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_assign_alias()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tag      CHAR(2);
  v_zone_pad TEXT;
  v_seq      INTEGER;
BEGIN
  -- Only run if zone_code is present and no alias assigned yet
  IF NEW.zone_code IS NULL OR NEW.alias_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve zone tag — skip silently if zone not in registry
  SELECT zone_tag INTO v_tag
  FROM public.alias_zone_tags
  WHERE zone_code = NEW.zone_code;

  IF v_tag IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atomic counter increment
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

  -- Format: TAG(2) + ZONEPAD(2) + "-" + SEQ(3) = 8 chars, e.g. "WB61-001"
  v_zone_pad := LPAD(RIGHT(NEW.zone_code::TEXT, 2), 2, '0');
  NEW.alias_code := v_tag || v_zone_pad || '-' || LPAD(v_seq::TEXT, 3, '0');

  -- Register in alias_registry
  INSERT INTO public.alias_registry (alias_code, unit_id, zone_code, zone_index)
  VALUES (NEW.alias_code, NEW.id, NEW.zone_code, v_seq)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_alias ON public.units;
CREATE TRIGGER trg_unit_alias
  BEFORE INSERT ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_alias();
