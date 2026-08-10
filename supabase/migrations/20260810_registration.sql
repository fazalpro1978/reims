-- Self-registration support
-- Adds company, phone, registration_status to profiles.
-- Updates the auto-create trigger to handle self-registered users (pending approval).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone             TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_status TEXT
  NOT NULL DEFAULT 'approved'
  CHECK (registration_status IN ('approved', 'pending', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_profiles_reg_status ON public.profiles(registration_status)
  WHERE registration_status = 'pending';

-- Updated trigger: self-registered users land as inactive + pending
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_self_reg BOOLEAN := coalesce((NEW.raw_user_meta_data->>'self_registered')::BOOLEAN, false);
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company, phone, is_active, registration_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    'staff',
    NULLIF(NEW.raw_user_meta_data->>'company', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NOT v_self_reg,
    CASE WHEN v_self_reg THEN 'pending' ELSE 'approved' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
