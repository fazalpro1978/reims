-- ================================================================
-- Role Permissions Matrix — Vanguard REOS · PropertyScape
-- Run in Supabase Dashboard → SQL Editor on both projects
-- Production : hbpxufqrdqaycwovirns
-- Testing    : hsulqoavwmsvffsbzoan
-- ================================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  permission_key  TEXT        NOT NULL,
  role            TEXT        NOT NULL
    CHECK (role IN ('superuser','administrator','staff','agent','public')),
  level           TEXT        NOT NULL
    CHECK (level IN ('full','limited','none')),
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (permission_key, role)
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_role_permission_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_role_permission_updated_at ON public.role_permissions;
CREATE TRIGGER trg_role_permission_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_role_permission_updated_at();

-- RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "service_role full access" ON public.role_permissions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON public.role_permissions TO authenticated, anon;
GRANT ALL    ON public.role_permissions TO service_role;
