-- ─────────────────────────────────────────────────────────────────────────────
-- Ingestion Engine v2 — Incremental update, conflict detection, audit trail
-- Run in Supabase Dashboard → SQL Editor (Production project)
-- ADDITIVE ONLY — zero changes to existing tables.
-- ROLLBACK: execute 20240107_ingestion_engine_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Source file registry ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  source_file     TEXT         NOT NULL,
  file_hash       TEXT         NOT NULL,            -- SHA-256, detects duplicate uploads
  file_size       BIGINT,
  source_type     TEXT         NOT NULL DEFAULT 'broker',
                               -- developer | property_mgmt | broker | informal
  trust_level     SMALLINT     NOT NULL DEFAULT 3,  -- 1=highest … 4=lowest
  uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  uploaded_by     TEXT         NOT NULL DEFAULT 'Administrator',
  status          TEXT         NOT NULL DEFAULT 'processing'
                               CHECK (status IN ('processing','verified','imported','rejected')),
  record_count    INT          NOT NULL DEFAULT 0,
  new_count       INT          NOT NULL DEFAULT 0,
  update_count    INT          NOT NULL DEFAULT 0,
  conflict_count  INT          NOT NULL DEFAULT 0,
  skipped_count   INT          NOT NULL DEFAULT 0,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_hash       ON ingestion_runs(file_hash);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_uploaded   ON ingestion_runs(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status     ON ingestion_runs(status);

-- ── 2. Per-record extraction results ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_records (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id              UUID    NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  unit_id             UUID    REFERENCES units(id) ON DELETE SET NULL,  -- null = unresolved/new
  match_type          TEXT    CHECK (match_type IN
                                ('exact_code','natural_key','fuzzy','unresolved')),
  match_confidence    DECIMAL(4,3) DEFAULT NULL,   -- 0.000–1.000
  raw_data            JSONB   NOT NULL,            -- exactly what Claude returned
  resolved_data       JSONB   NOT NULL,            -- after normalization & merge policy
  action              TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (action IN ('new','update','conflict','skip','pending')),
  conflict_fields     JSONB   DEFAULT NULL,        -- {field: {existing, incoming}}
  applied             BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at          TIMESTAMPTZ DEFAULT NULL,
  row_index           INT                          -- position in source file
);

CREATE INDEX IF NOT EXISTS idx_ing_records_run    ON ingestion_records(run_id);
CREATE INDEX IF NOT EXISTS idx_ing_records_unit   ON ingestion_records(unit_id);
CREATE INDEX IF NOT EXISTS idx_ing_records_action ON ingestion_records(action);

-- ── 3. Field-level audit trail ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unit_changes (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id         UUID         NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  run_id          UUID         REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  field_name      TEXT         NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  changed_by      TEXT         NOT NULL DEFAULT 'system:ingestion',
  source_file     TEXT,
  change_type     TEXT         NOT NULL DEFAULT 'update'
                               CHECK (change_type IN ('create','update','manual','rollback'))
);

CREATE INDEX IF NOT EXISTS idx_unit_changes_unit    ON unit_changes(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_changes_run     ON unit_changes(run_id);
CREATE INDEX IF NOT EXISTS idx_unit_changes_at      ON unit_changes(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_unit_changes_field   ON unit_changes(field_name);

-- ── 4. Full version snapshots (before every write) ───────────────────────────
CREATE TABLE IF NOT EXISTS unit_versions (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id         UUID         NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  snapshot        JSONB        NOT NULL,           -- complete units row at this moment
  snapshotted_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  trigger         TEXT         NOT NULL DEFAULT 'ingestion'
                               CHECK (trigger IN ('ingestion','manual_edit','status_change','rollback')),
  run_id          UUID         REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  version_number  INT          NOT NULL DEFAULT 1  -- incremented per unit
);

CREATE INDEX IF NOT EXISTS idx_unit_versions_unit ON unit_versions(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_versions_at   ON unit_versions(snapshotted_at DESC);

-- Auto-increment version_number per unit
CREATE OR REPLACE FUNCTION set_unit_version_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO NEW.version_number
    FROM unit_versions
   WHERE unit_id = NEW.unit_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unit_version_number ON unit_versions;
CREATE TRIGGER trg_unit_version_number
  BEFORE INSERT ON unit_versions
  FOR EACH ROW EXECUTE FUNCTION set_unit_version_number();

-- ── 5. Building alias map (fuzzy matching reference) ─────────────────────────
CREATE TABLE IF NOT EXISTS building_aliases (
  id              UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name  TEXT  NOT NULL,   -- normalised display name stored in units.property
  alias           TEXT  NOT NULL,   -- variant seen in source files
  UNIQUE (alias)
);

-- Seed known aliases from the sample files we reviewed
INSERT INTO building_aliases (canonical_name, alias) VALUES
  ('Al Darwish Tower',      'al darwish tower west bay'),
  ('Al Darwish Tower',      'al darwish'),
  ('Al Darwish Tower',      'adw'),
  ('Retaj La Plage',        'retaj la plage'),
  ('Retaj La Plage',        'la plage'),
  ('Retaj Baywalk',         'retaj baywalk residence'),
  ('Retaj Baywalk',         'retaj baywalk'),
  ('West Walk Residence 1', 'west walk residence 1'),
  ('West Walk Residence 1', 'west walk'),
  ('AL EMADI Airport A6',   'e-a6 airport'),
  ('AL EMADI Airport A6',   'e-a6'),
  ('AL EMADI Airport A22',  'e-a22 airport'),
  ('AL EMADI Airport A22',  'e-a22'),
  ('AL EMADI Muntazah E11', 'e11 muntazah'),
  ('AL EMADI Najma A',      'e19 najma building a'),
  ('AL EMADI Najma B',      'e19 najma building b')
ON CONFLICT (alias) DO NOTHING;

-- ── 6. Grants ─────────────────────────────────────────────────────────────────
GRANT ALL ON ingestion_runs    TO service_role, anon, authenticated;
GRANT ALL ON ingestion_records TO service_role, anon, authenticated;
GRANT ALL ON unit_changes      TO service_role, anon, authenticated;
GRANT ALL ON unit_versions     TO service_role, anon, authenticated;
GRANT ALL ON building_aliases  TO service_role, anon, authenticated;
