-- ════════════════════════════════════════════════════════════════════════════
-- 20260808_external_role_rls.sql
-- Row-level security for agent / broker / third_party roles.
-- These are the DB-level enforcement layer — the API scrub layer is a second
-- independent guard, not a replacement for these policies.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Ensure new roles exist in the profiles role check constraint ──────────
-- (If profiles.role has a check constraint, add the new values)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superuser','administrator','staff','agent','broker','third_party','public'));

-- ── 2. inquiries — external roles see only their own rows ────────────────────
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiries_role_access" ON public.inquiries;
CREATE POLICY "inquiries_role_access" ON public.inquiries
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser','administrator','staff')
    OR created_by = auth.uid()
    OR assigned_agent = auth.uid()
  );

-- ── 3. inquiry_matches — follows the parent inquiry ownership ────────────────
ALTER TABLE public.inquiry_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiry_matches_role_access" ON public.inquiry_matches;
CREATE POLICY "inquiry_matches_role_access" ON public.inquiry_matches
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser','administrator','staff')
    OR inquiry_id IN (
      SELECT id FROM public.inquiries
      WHERE created_by = auth.uid() OR assigned_agent = auth.uid()
    )
  );

-- ── 4. units — external roles see available units only ───────────────────────
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "units_role_access" ON public.units;
CREATE POLICY "units_role_access" ON public.units
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser','administrator','staff')
    OR status = 'Available'
  );

-- ── 5. alias_registry — internal roles only ──────────────────────────────────
ALTER TABLE public.alias_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alias_registry_internal_only" ON public.alias_registry;
CREATE POLICY "alias_registry_internal_only" ON public.alias_registry
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser','administrator','staff')
  );

-- ── 6. alias_zone_tags — readable by all authenticated ───────────────────────
ALTER TABLE public.alias_zone_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alias_zone_tags_read_all" ON public.alias_zone_tags;
CREATE POLICY "alias_zone_tags_read_all" ON public.alias_zone_tags
  FOR SELECT TO authenticated USING (true);

-- ── Done ─────────────────────────────────────────────────────────────────────
