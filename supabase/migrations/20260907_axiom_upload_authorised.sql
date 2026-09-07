-- Add axiom_upload_authorised flag to profiles
-- Run on Production: hbpxufqrdqaycwovirns
-- Run on Testing:    hsulqoavwmsvffsbzoan

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS axiom_upload_authorised BOOLEAN NOT NULL DEFAULT false;

-- Backfill: grant to existing SU/Admin who already have 'axiom' in platforms
-- or are superuser/administrator (platform badge may pre-date this column)
UPDATE public.profiles
SET axiom_upload_authorised = true
WHERE role IN ('superuser', 'administrator')
   OR 'axiom' = ANY(platforms);

-- Trigger: keep axiom_upload_authorised in sync with platforms array automatically
CREATE OR REPLACE FUNCTION public.sync_axiom_upload_authorised()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.platforms IS DISTINCT FROM OLD.platforms THEN
    NEW.axiom_upload_authorised :=
      ('axiom' = ANY(NEW.platforms)) OR (NEW.role IN ('superuser', 'administrator'));
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.axiom_upload_authorised :=
      ('axiom' = ANY(NEW.platforms)) OR (NEW.role IN ('superuser', 'administrator'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_axiom_authorised ON public.profiles;
CREATE TRIGGER trg_sync_axiom_authorised
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_axiom_upload_authorised();
