-- ════════════════════════════════════════════════════════════════════════════
-- 20260809_realtor_moci_nullable.sql
-- Make realtor_moci nullable so imports succeed when the column is absent
-- from the spreadsheet and the realtor is not yet in the realtors table.
-- The ingest/apply route already auto-fills realtor_moci from the realtors
-- table by name match; this is a fallback safety net only.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.units
  ALTER COLUMN realtor_moci DROP NOT NULL;
