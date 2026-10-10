-- ── Client database ──────────────────────────────────────────────────────────
-- One record per person (dedup key: phone).
-- Inquiries gain a client_id FK so every inquiry traces back to one client.

CREATE TABLE IF NOT EXISTS clients (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT        NOT NULL,
  phone               TEXT        UNIQUE,
  email               TEXT,
  nationality         TEXT,
  source              TEXT        NOT NULL DEFAULT 'synergy',
  tags                TEXT[]      NOT NULL DEFAULT '{}',
  whatsapp_opt_in     BOOLEAN     NOT NULL DEFAULT false,
  whatsapp_opt_in_at  TIMESTAMPTZ,
  email_opt_in        BOOLEAN     NOT NULL DEFAULT false,
  email_opt_in_at     TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_phone_idx ON clients (phone);
CREATE INDEX IF NOT EXISTS clients_tags_idx  ON clients USING GIN (tags);

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inquiries_client_id_idx ON inquiries (client_id);

-- ── Backfill: one client per unique phone ────────────────────────────────────
-- Use the most-recent inquiry's name as the canonical client name.
-- All existing clients bulk opted-in (management decision, timestamp = now()).

WITH ranked AS (
  SELECT DISTINCT ON (client_phone)
    client_phone,
    client_name,
    client_email,
    client_nationality,
    source
  FROM inquiries
  WHERE client_phone IS NOT NULL AND client_phone <> ''
  ORDER BY client_phone, created_at DESC
),
inserted AS (
  INSERT INTO clients (
    full_name, phone, email, nationality, source,
    whatsapp_opt_in, whatsapp_opt_in_at,
    email_opt_in,    email_opt_in_at
  )
  SELECT
    r.client_name,
    r.client_phone,
    r.client_email,
    r.client_nationality,
    COALESCE(r.source, 'synergy'),
    true, now(),
    true, now()
  FROM ranked r
  ON CONFLICT (phone) DO NOTHING
  RETURNING id, phone
)
UPDATE inquiries i
SET client_id = ins.id
FROM inserted ins
WHERE i.client_phone = ins.phone;

-- ── Backfill: inquiries with no phone (dedup by normalised name) ─────────────
WITH no_phone AS (
  SELECT DISTINCT ON (LOWER(TRIM(client_name)))
    client_name, client_email, client_nationality, source
  FROM inquiries
  WHERE (client_phone IS NULL OR client_phone = '')
    AND client_id IS NULL
  ORDER BY LOWER(TRIM(client_name)), created_at DESC
),
inserted2 AS (
  INSERT INTO clients (
    full_name, phone, email, nationality, source,
    whatsapp_opt_in, whatsapp_opt_in_at,
    email_opt_in,    email_opt_in_at
  )
  SELECT
    np.client_name, NULL, np.client_email, np.client_nationality,
    COALESCE(np.source, 'synergy'),
    true, now(),
    true, now()
  FROM no_phone np
  RETURNING id, full_name
)
UPDATE inquiries i
SET client_id = ins2.id
FROM inserted2 ins2
WHERE i.client_id IS NULL
  AND (i.client_phone IS NULL OR i.client_phone = '')
  AND LOWER(TRIM(i.client_name)) = LOWER(TRIM(ins2.full_name));
