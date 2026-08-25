-- Phase 0 prerequisites
-- Order matters: drop triggers FIRST, then add columns
-- Run this migration before any UI changes go live.

-- 1. Drop alias auto-generate triggers (prevents new units from getting alias_codes)
DROP TRIGGER IF EXISTS trg_unit_alias          ON public.units;
DROP TRIGGER IF EXISTS trg_unit_alias_register ON public.units;
DROP FUNCTION IF EXISTS fn_unit_alias_before();
DROP FUNCTION IF EXISTS fn_unit_alias_after();

-- 2. Add smart_code to units (nullable; FK deferred until Phase F backfill validation)
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS smart_code VARCHAR(14);

CREATE INDEX IF NOT EXISTS units_smart_code_idx ON public.units (smart_code)
  WHERE smart_code IS NOT NULL;

-- 3. Add agent_code to profiles so logged-in user's code pre-populates the Code Registry panel
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_code VARCHAR(2) REFERENCES public.cr_agents(agent_code) ON DELETE SET NULL;

-- 4. Verify cr_generate_smart_code is the category-aware version (4-digit sequence, 10-char prefix)
--    Run the query below in Supabase SQL Editor and confirm 'v_prefix' contains category prefix:
--      SELECT prosrc FROM pg_proc WHERE proname = 'cr_generate_smart_code';
--    Expected: v_prefix := v_category || p_type_code || p_entity_code || p_agent_code || v_zone_padded
--    If it does NOT contain v_category, run the function body from 20240112_full_parity.sql manually.

-- 5. Backfill note:
--    units.smart_code cannot be auto-backfilled because cr_registry.unit_ref is free text with
--    no FK to units.id. Backfill must be performed manually by a Superuser using:
--      UPDATE public.units u SET smart_code = r.smart_code
--      FROM public.cr_registry r
--      WHERE r.unit_ref = u.unit_no AND r.building_name ILIKE '%' || u.property || '%'
--      AND u.smart_code IS NULL;
--    Validate results before Phase F alias column drop.
