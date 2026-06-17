-- ─────────────────────────────────────────────────────────────────────────────
-- Synergy Center — Inquiry Matching & Auto-Shortlist Engine
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Inquiries ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inquiries (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_no          TEXT         UNIQUE,                         -- INQ-202601-0001
  -- Contact
  client_name     TEXT         NOT NULL,
  client_phone    TEXT,
  client_email    TEXT,
  client_nationality TEXT,
  -- Source
  source          TEXT         CHECK (source IN ('Walk-in','WhatsApp','Website','Referral','Bayut','Property Finder','Phone','Other')),
  -- Requirements
  listing_type    TEXT         CHECK (listing_type IN ('Rent','Sale')),
  property_type   TEXT,
  config          TEXT,
  bathrooms_min   NUMERIC,
  budget_min      NUMERIC,
  budget_max      NUMERIC,
  preferred_zones TEXT[],
  furnishing      TEXT,
  -- Pipeline
  status          TEXT         NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','contacted','viewing','negotiating','won','lost')),
  assigned_agent  TEXT,
  follow_up_date  DATE,
  notes           TEXT,
  -- Match metadata
  last_matched_at TIMESTAMPTZ,
  match_count     INT          NOT NULL DEFAULT 0,
  -- Timestamps
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inq_status  ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inq_agent   ON inquiries(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_inq_created ON inquiries(created_at DESC);

-- Auto-generate ref_no on insert
CREATE OR REPLACE FUNCTION set_inquiry_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ym   TEXT := to_char(now(), 'YYYYMM');
  seq  INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(ref_no, '-', 3) AS INT)), 0) + 1
    INTO seq
    FROM inquiries
   WHERE ref_no LIKE 'INQ-' || ym || '-%';
  NEW.ref_no := 'INQ-' || ym || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiry_ref_no ON inquiries;
CREATE TRIGGER trg_inquiry_ref_no
  BEFORE INSERT ON inquiries
  FOR EACH ROW WHEN (NEW.ref_no IS NULL)
  EXECUTE FUNCTION set_inquiry_ref_no();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_inquiry_updated ON inquiries;
CREATE TRIGGER trg_inquiry_updated
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 2. Inquiry Matches ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inquiry_matches (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id      UUID         NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  unit_id         UUID,
  unit_code       TEXT,
  unit_snapshot   JSONB        NOT NULL,   -- property, zone, type, config, rent, status at match time
  match_tier      INT          NOT NULL CHECK (match_tier IN (1,2,3)),
  match_score     NUMERIC(5,2) NOT NULL,
  match_reasons   JSONB        NOT NULL,   -- {budget, type, config, bathrooms, zone}
  is_shortlisted  BOOLEAN      NOT NULL DEFAULT false,
  shortlisted_at  TIMESTAMPTZ,
  shortlisted_by  TEXT,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(inquiry_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_match_inquiry    ON inquiry_matches(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_match_shortlist  ON inquiry_matches(is_shortlisted);
CREATE INDEX IF NOT EXISTS idx_match_tier       ON inquiry_matches(match_tier);

-- ── 3. Notifications ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT         NOT NULL
                               CHECK (type IN ('new_match','unit_blocked','new_inquiry','daily_digest','follow_up')),
  title           TEXT         NOT NULL,
  body            TEXT,
  inquiry_id      UUID         REFERENCES inquiries(id) ON DELETE SET NULL,
  unit_id         UUID,
  assigned_agent  TEXT,
  is_read         BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_agent   ON notifications(assigned_agent);
