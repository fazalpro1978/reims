-- Override audit trail table.
-- Written on every post-generation code edit in AXIOM Stage 2.
-- Superusers can promote patterns (reason_code count >= 3) to rule updates in Phase E.

CREATE TABLE IF NOT EXISTS public.cr_code_overrides (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  registry_id   UUID         NOT NULL REFERENCES public.cr_registry(id) ON DELETE CASCADE,
  smart_code    VARCHAR(14)  NOT NULL,
  override_by   UUID         NOT NULL REFERENCES auth.users(id),
  reason_code   VARCHAR(30)  NOT NULL CHECK (reason_code IN (
                  'CONFIG_MISMATCH',
                  'ENTITY_MISMATCH',
                  'ZONE_MISMATCH',
                  'AGENT_MISMATCH',
                  'DUPLICATE_OVERRIDE',
                  'RE_UPLOAD_UPDATE',
                  'SOURCE_ERROR',
                  'SYSTEM_ERROR',
                  'OTHER'
                )),
  reason_text   TEXT,
  field_changed VARCHAR(50)  NOT NULL,
  value_before  TEXT,
  value_after   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_code_overrides_registry_id_idx ON public.cr_code_overrides (registry_id);
CREATE INDEX IF NOT EXISTS cr_code_overrides_reason_code_idx ON public.cr_code_overrides (reason_code);
CREATE INDEX IF NOT EXISTS cr_code_overrides_created_at_idx  ON public.cr_code_overrides (created_at DESC);
CREATE INDEX IF NOT EXISTS cr_code_overrides_override_by_idx ON public.cr_code_overrides (override_by);
