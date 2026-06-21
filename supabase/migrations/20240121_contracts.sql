-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Contracts & Legal — Google Drive document registry

CREATE TABLE IF NOT EXISTS public.contracts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id    TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  mime_type        TEXT,
  client_name      TEXT,
  asset_token      TEXT,           -- 14-digit asset/lease code
  folder_path      TEXT,
  drive_url        TEXT,
  file_size        BIGINT,
  drive_created_at TIMESTAMPTZ,
  drive_modified_at TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_client       ON public.contracts (client_name);
CREATE INDEX IF NOT EXISTS idx_contracts_asset_token  ON public.contracts (asset_token);
CREATE INDEX IF NOT EXISTS idx_contracts_mime         ON public.contracts (mime_type);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_contracts"
  ON public.contracts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_contracts"
  ON public.contracts FOR SELECT
  TO authenticated USING (true);

GRANT SELECT ON public.contracts TO authenticated, anon;
GRANT ALL    ON public.contracts TO service_role;
