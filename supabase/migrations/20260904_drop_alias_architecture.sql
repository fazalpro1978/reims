-- Phase A: Drop alias_code architecture
-- Pre-flight: run this and confirm it returns 0 before applying:
--   SELECT COUNT(*) FROM public.units
--   WHERE alias_code IS NOT NULL AND (smart_code IS NULL OR smart_code = '');

-- Drop triggers (safety no-ops — already dropped in phase0_prereqs)
DROP TRIGGER IF EXISTS trg_unit_alias          ON public.units;
DROP TRIGGER IF EXISTS trg_unit_alias_register ON public.units;

-- Drop functions
DROP FUNCTION IF EXISTS public.auto_assign_alias();
DROP FUNCTION IF EXISTS public.auto_register_alias();
DROP FUNCTION IF EXISTS public.alias_next_seq(INTEGER);

-- Drop tables (CASCADE drops dependent policies, sequences, indexes)
DROP TABLE IF EXISTS public.alias_resolution_log  CASCADE;
DROP TABLE IF EXISTS public.alias_registry         CASCADE;
DROP TABLE IF EXISTS public.alias_zone_counters    CASCADE;
DROP TABLE IF EXISTS public.alias_zone_tags        CASCADE;

-- Drop alias_code column from units
ALTER TABLE public.units DROP COLUMN IF EXISTS alias_code;
