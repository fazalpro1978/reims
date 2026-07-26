-- ── User Roles & Profiles ──────────────────────────────────────────────────
-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Creates public.profiles table linked to auth.users.
-- Auto-creates a profile row on every Supabase Auth user signup (via trigger).
-- Default role for new signups is 'staff'; admins promote as needed.

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  role        TEXT        NOT NULL DEFAULT 'staff'
              CHECK (role IN ('superuser','administrator','staff','agent','public')),
  department  TEXT        DEFAULT 'Privé Group Real Estate',
  platforms   TEXT[]      DEFAULT ARRAY['reims'],
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profile_updated_at ON public.profiles;
CREATE TRIGGER trg_profile_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();

-- 3. Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read their own profile
DROP POLICY IF EXISTS "own profile read"  ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Superusers and admins can read ALL profiles
DROP POLICY IF EXISTS "admin read all"    ON public.profiles;
CREATE POLICY "admin read all" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('superuser','administrator')
        AND p.is_active = true
    )
  );

-- Superusers and admins can write (update roles, deactivate)
DROP POLICY IF EXISTS "admin write all"   ON public.profiles;
CREATE POLICY "admin write all" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('superuser','administrator')
        AND p.is_active = true
    )
  );

-- Service role bypasses RLS
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO authenticated;

-- ── SETUP INSTRUCTIONS ──────────────────────────────────────────────────────
-- After running this migration:
--
-- 1. In Supabase Dashboard → Authentication → Users → Invite User:
--    Invite each person with their email.  The trigger auto-creates their
--    profile row with role = 'staff' when they accept the invite.
--
-- 2. Then in REIMS → Admin Console → Users, change each person's role:
--    Ahmed Ali             → superuser
--    Nadeem E Leeman       → administrator
--    Mohamed Elazazy       → staff  (already default)
--    Abid Hussain          → staff
--    Shihan Buhary         → staff
--    Abdul Shahan          → staff
--    Fazlur Rahman Mushaffiq → staff
--    Mohammed Saahir       → agent
--
-- 3. For dInges access, update platforms array:
--    Ahmed Ali, Nadeem E Leeman → ARRAY['reims','dinges']
