-- =============================================================================
-- RE-IMS — Privé Group Real Estate
-- Migration 001: Initial Schema
-- Apply to both reims-testing and reims-production via SQL Editor
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE unit_type AS ENUM (
  'Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Duplex', 'Office'
);

CREATE TYPE furnishing_type AS ENUM (
  'Fully Furnished', 'Semi-Furnished', 'Unfurnished'
);

CREATE TYPE listing_type AS ENUM ('Rent', 'Sale');

CREATE TYPE unit_status AS ENUM (
  'Available', 'Leased', 'Reserved', 'Under_Maintenance'
);

CREATE TYPE kitchen_type AS ENUM ('Open', 'Closed', 'Yes', 'Pantry');

CREATE TYPE property_reg_status AS ENUM (
  'Registered',
  'Not Registered',
  'Pending Registration',
  'Exempt',
  'Under Review',
  'Expired',
  'Renewal Due'
);

CREATE TYPE client_type AS ENUM ('Individual', 'Company');

CREATE TYPE duration_unit AS ENUM ('Days', 'Weeks', 'Months', 'Years');

CREATE TYPE paid_by_option AS ENUM (
  'Developer', 'Real Estate Company', 'Agent', 'Client', 'Other'
);

-- ── Trigger helpers ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Table: units (core) ───────────────────────────────────────────────────────

CREATE TABLE units (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  realtor_name         TEXT          NOT NULL,
  realtor_moci         TEXT          NOT NULL,

  -- Property
  property             TEXT          NOT NULL,
  unit_no              TEXT          NOT NULL,
  zone_code            INTEGER       NOT NULL,
  zone                 TEXT          NOT NULL,
  type                 unit_type     NOT NULL,
  config               TEXT          NOT NULL,

  -- Features
  bathrooms            NUMERIC(3,1)  NOT NULL CHECK (bathrooms >= 0),
  parking              BOOLEAN       NOT NULL DEFAULT false,
  kitchen              kitchen_type  NOT NULL,

  -- Classification
  furnishing           furnishing_type NOT NULL,
  listing_type         listing_type    NOT NULL DEFAULT 'Rent',
  status               unit_status     NOT NULL DEFAULT 'Available',

  -- Financials (QAR)
  rent                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rent >= 0),
  service_charges      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charges >= 0),
  deposit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  agency_fee           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (agency_fee >= 0),

  -- Legal
  moci_contract_number TEXT,
  legal_duration       TEXT,
  contract_start_date  DATE,
  contract_end_date    DATE,

  -- Links
  location_map_url     TEXT,
  media_url            TEXT,
  asset_history_links  TEXT[]        NOT NULL DEFAULT '{}',

  -- Metadata
  listed_date          DATE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT units_contract_dates CHECK (
    contract_end_date IS NULL OR contract_start_date IS NULL
    OR contract_end_date >= contract_start_date
  )
);

CREATE TRIGGER units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Table: unit_commissions (1:1) ─────────────────────────────────────────────

CREATE TABLE unit_commissions (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID              NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  agency_fee_applicable BOOLEAN           NOT NULL DEFAULT false,
  agency_fee_amount     NUMERIC(12,2)     CHECK (agency_fee_amount >= 0),
  paid_by               paid_by_option,
  paid_by_other         TEXT,             -- populated when paid_by = 'Other'

  property_reg_status   property_reg_status NOT NULL DEFAULT 'Not Registered',
  registration_by       TEXT,

  duration_value        INTEGER           CHECK (duration_value > 0),
  duration_unit         duration_unit,

  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  UNIQUE (unit_id)
);

CREATE TRIGGER unit_commissions_updated_at
  BEFORE UPDATE ON unit_commissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Table: unit_clients (1:1, extensible to 1:many) ──────────────────────────

CREATE TABLE unit_clients (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  client_type           client_type   NOT NULL DEFAULT 'Individual',
  full_name             TEXT,
  qid_cr_number         TEXT,
  nationality           TEXT,
  mobile_number         TEXT,
  email                 TEXT,
  employer              TEXT,
  authorized_signatory  TEXT,         -- Company type only
  emergency_contact     TEXT,
  notes                 TEXT,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (unit_id)
);

CREATE TRIGGER unit_clients_updated_at
  BEFORE UPDATE ON unit_clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Table: unit_documents (1:many) ────────────────────────────────────────────

CREATE TABLE unit_documents (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id        UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  doc_type       TEXT          NOT NULL,   -- 'QID' | 'Passport' | 'CR' | 'Computer Card'
  file_name      TEXT          NOT NULL,
  file_size      INTEGER       CHECK (file_size > 0),
  storage_path   TEXT          NOT NULL,   -- Supabase Storage object path
  public_url     TEXT,                     -- signed / public URL cached at upload time

  uploaded_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  uploaded_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── Table: unit_operational (1:1) ─────────────────────────────────────────────

CREATE TABLE unit_operational (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id              UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  focal_point_name     TEXT,
  focal_point_phone    TEXT,
  focal_point_email    TEXT,
  operator_remarks     TEXT,
  maintenance_notes    TEXT,
  access_lockbox       TEXT,

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (unit_id)
);

CREATE TRIGGER unit_operational_updated_at
  BEFORE UPDATE ON unit_operational
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Table: audit_log (append-only, no UPDATE/DELETE) ─────────────────────────

CREATE TABLE audit_log (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  field        TEXT          NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_by   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_units_status       ON units (status);
CREATE INDEX idx_units_type         ON units (type);
CREATE INDEX idx_units_zone         ON units (zone);
CREATE INDEX idx_units_realtor      ON units (realtor_name);
CREATE INDEX idx_units_config       ON units (config);
CREATE INDEX idx_units_rent         ON units (rent);
CREATE INDEX idx_units_listed_date  ON units (listed_date DESC);

CREATE INDEX idx_unit_documents_unit ON unit_documents (unit_id);
CREATE INDEX idx_audit_log_unit      ON audit_log (unit_id);
CREATE INDEX idx_audit_log_time      ON audit_log (changed_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_commissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_operational   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access (role-based restrictions added in 002_roles.sql)
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'units','unit_commissions','unit_clients',
    'unit_documents','unit_operational','audit_log'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'authenticated_full_access_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ── Supabase Storage bucket ───────────────────────────────────────────────────
-- Run this separately in the Storage section OR via the Management API.
-- Bucket name: unit-documents  |  public: false  |  allowed MIME: application/pdf

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('unit-documents', 'unit-documents', false, 10485760, ARRAY['application/pdf'])
-- ON CONFLICT (id) DO NOTHING;
