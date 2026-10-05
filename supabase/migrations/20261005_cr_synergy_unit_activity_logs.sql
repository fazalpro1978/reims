-- Unit-level activity ledger for Synergy Centre matching cards.
-- Each row records a consultant's timestamped note bound to a specific
-- unit_code + lead_id combination across all pipeline stages.

CREATE TABLE IF NOT EXISTS public.cr_synergy_unit_activity_logs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code          TEXT        NOT NULL,
  lead_id            TEXT        NOT NULL,
  author_id          UUID        NOT NULL,
  author_name        TEXT        NOT NULL,
  pipeline_stage     TEXT        NOT NULL,
  note               TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_sual_unit_lead
  ON public.cr_synergy_unit_activity_logs (unit_code, lead_id);

CREATE INDEX IF NOT EXISTS cr_sual_author
  ON public.cr_synergy_unit_activity_logs (author_id);

ALTER TABLE public.cr_synergy_unit_activity_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users may read logs for units they can see;
-- service role bypasses RLS for API writes.
CREATE POLICY "authenticated read"
  ON public.cr_synergy_unit_activity_logs
  FOR SELECT
  TO authenticated
  USING (true);
