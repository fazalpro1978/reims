-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- One-time sync: reconcile cr_entity_codes ↔ public.realtors
-- so that all existing companies are visible in every workspace.

-- Step 1: cr_entity_codes → public.realtors
-- Adds any entity not yet in the realtor registry
INSERT INTO public.realtors (name, classification)
SELECT
  e.company_name,
  e.classification
FROM cr_entity_codes e
WHERE NOT EXISTS (
  SELECT 1 FROM public.realtors r WHERE LOWER(r.name) = LOWER(e.company_name)
);

-- Step 2: public.realtors → cr_entity_codes
-- Adds any realtor not yet in the entity registry (derives a best-effort 3-char code).
-- Conflicts on entity_code are ignored; the row is simply skipped if code collides.
INSERT INTO cr_entity_codes (entity_code, company_name, classification, is_manual)
SELECT
  LEFT(
    UPPER(REGEXP_REPLACE(r.name, '[^A-Z0-9]', '', 'g')) || 'ZZZ',
    3
  ),
  r.name,
  COALESCE(r.classification, 'Independent'),
  true
FROM public.realtors r
WHERE NOT EXISTS (
  SELECT 1 FROM cr_entity_codes e WHERE LOWER(e.company_name) = LOWER(r.name)
)
ON CONFLICT (entity_code) DO NOTHING;
