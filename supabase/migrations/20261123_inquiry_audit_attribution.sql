-- Audit attribution for Synergy inquiries: who last ran matching, plus an inquiry-level event ledger.
-- created_by_name / created_by_email already exist (20261010_inquiries_created_by.sql).

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS last_matched_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS last_matched_by_email TEXT;

CREATE TABLE IF NOT EXISTS public.cr_inquiry_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID        NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL CHECK (event_type IN ('created','match_auto','match_manual','match_bulk')),
  actor_name   TEXT,
  actor_email  TEXT,
  actor_code   TEXT,
  details      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_inquiry_events_inquiry
  ON public.cr_inquiry_events (inquiry_id, created_at);

GRANT ALL ON public.cr_inquiry_events TO service_role;
ALTER TABLE public.cr_inquiry_events ENABLE ROW LEVEL SECURITY;
-- No client policies: read/write only through the API (service role), which enforces inquiry access.

-- Backfill 'created' events from the immutable creator columns (past match runs were never recorded).
INSERT INTO public.cr_inquiry_events (inquiry_id, event_type, actor_name, actor_email, created_at)
SELECT i.id, 'created', i.created_by_name, i.created_by_email, i.created_at
FROM public.inquiries i
WHERE NOT EXISTS (SELECT 1 FROM public.cr_inquiry_events e WHERE e.inquiry_id = i.id AND e.event_type = 'created');
