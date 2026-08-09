CREATE TABLE IF NOT EXISTS circle_of_excellence (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name    TEXT         NOT NULL DEFAULT '',
  employee_title   TEXT,
  month_year       TEXT,
  message          TEXT,
  photo_url        TEXT,
  certificate_url  TEXT,
  certificate_type TEXT         CHECK (certificate_type IN ('image', 'pdf')),
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  published_by     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coe_created ON circle_of_excellence(created_at DESC);
