-- Add match_priority column to inquiry_matches.
-- Stores the tie-break key computed by the matching engine so the DB
-- ORDER BY clause (tier ASC, score DESC, priority DESC) is stable even
-- when two units share the same rounded score%.
-- Priority encodes field match quality in descending weight order:
--   Config > Budget Min > Zone > Type > Bathrooms > Furnishing > Budget Fit

ALTER TABLE public.inquiry_matches
  ADD COLUMN IF NOT EXISTS match_priority BIGINT DEFAULT 0;
