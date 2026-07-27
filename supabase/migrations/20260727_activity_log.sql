-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Activity log — records unit INSERT/UPDATE events for the dashboard feed.

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT         NOT NULL,
  entity_type TEXT         NOT NULL DEFAULT 'unit',
  entity_id   TEXT         NOT NULL,
  description TEXT         NOT NULL,
  actor_email TEXT,
  meta        JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type  ON public.activity_log (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id   ON public.activity_log (entity_id);

-- ── Trigger function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_unit_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  etype    TEXT;
  evt_desc TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    etype    := 'unit_added';
    evt_desc := 'Unit ' || NEW.unit_code || ' added to '
                || COALESCE(NEW.property, 'portfolio')
                || CASE WHEN NEW.zone IS NOT NULL THEN ' (' || NEW.zone || ')' ELSE '' END;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      etype    := 'unit_status_changed';
      evt_desc := NEW.unit_code || ' status changed from '
                  || OLD.status || ' → ' || NEW.status;
    ELSE
      etype    := 'unit_updated';
      evt_desc := 'Unit ' || NEW.unit_code || ' details updated';
    END IF;
  END IF;

  INSERT INTO public.activity_log (event_type, entity_type, entity_id, description, meta)
  VALUES (
    etype,
    'unit',
    NEW.unit_code,
    evt_desc,
    jsonb_build_object(
      'property', NEW.property,
      'zone',     NEW.zone,
      'type',     NEW.type,
      'status',   NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_activity ON public.units;
CREATE TRIGGER trg_unit_activity
  AFTER INSERT OR UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.log_unit_activity();

-- ── RLS + Realtime ────────────────────────────────────────────────────────────

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON public.activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role full access" ON public.activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO service_role;

-- Enable Supabase Realtime on this table
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
