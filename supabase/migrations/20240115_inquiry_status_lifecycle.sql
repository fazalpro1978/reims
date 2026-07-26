-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Expands inquiry pipeline with Cancelled + Closed stages, adds a
-- status_changed_at timestamp column for elapsed-time tracking, and
-- creates an immutable status-transition history table with DB triggers.

-- ── 1. Expand status CHECK constraint ───────────────────────────────────────

-- Drop any auto-generated status constraint
DO $$
DECLARE con TEXT;
BEGIN
  SELECT conname INTO con FROM pg_constraint
  WHERE conrelid = 'public.inquiries'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
    AND pg_get_constraintdef(oid) NOT LIKE '%listing_type%'
    AND pg_get_constraintdef(oid) NOT LIKE '%bills_included%';
  IF con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.inquiries DROP CONSTRAINT ' || quote_ident(con);
  END IF;
END $$;

-- Drop our named constraint if it already exists from a previous run
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('new','contacted','viewing','negotiating','won','lost','cancelled','closed'));

-- ── 2. Status timestamp column ───────────────────────────────────────────────

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Back-fill: existing rows get their created_at as the baseline
UPDATE public.inquiries
  SET status_changed_at = created_at
  WHERE status_changed_at IS NULL;

-- ── 3. Immutable history table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inquiry_status_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID        NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  from_status  TEXT,
  to_status    TEXT        NOT NULL,
  changed_by   TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ish_inquiry_id_at
  ON public.inquiry_status_history (inquiry_id, changed_at DESC);

-- ── 4. BEFORE trigger — keeps status_changed_at current ─────────────────────

CREATE OR REPLACE FUNCTION public.set_inquiry_status_changed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiry_status_changed_at ON public.inquiries;
CREATE TRIGGER trg_inquiry_status_changed_at
  BEFORE INSERT OR UPDATE OF status ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_inquiry_status_changed_at();

-- ── 5. AFTER trigger — appends immutable history row on every transition ─────
-- SECURITY DEFINER: runs as function owner (postgres) regardless of calling role,
-- so RLS / role restrictions on inquiry_status_history never block the insert.

GRANT SELECT, INSERT ON public.inquiry_status_history TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_inquiry_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.inquiry_status_history (inquiry_id, from_status, to_status, changed_by)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      NEW.assigned_agent
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiry_status_history ON public.inquiries;
CREATE TRIGGER trg_inquiry_status_history
  AFTER INSERT OR UPDATE OF status ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.log_inquiry_status_change();
