-- =============================================================================
-- REIMS — Full Schema Parity Script
-- Run on BOTH environments:
--   Production : https://hbpxufqrdqaycwovirns.supabase.co
--   Testing    : https://hsulqoavwmsvffsbzoan.supabase.co
--
-- SAFE TO RE-RUN — every statement is idempotent.
-- Covers all migrations 001 → 20240111 in dependency order.
-- Use this script to restore Testing → Production parity at any time.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. ENUMS  (wrapped in DO blocks — PostgreSQL has no IF NOT EXISTS for types)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE unit_type AS ENUM (
  'Apartment','Villa','Townhouse','Penthouse','Studio','Duplex','Office'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE furnishing_type AS ENUM (
  'Fully Furnished','Semi-Furnished','Unfurnished'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE listing_type AS ENUM ('Rent','Sale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE unit_status AS ENUM (
  'Available','Leased','Reserved','Under_Maintenance'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE kitchen_type AS ENUM ('Open','Closed','Yes','Pantry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE property_reg_status AS ENUM (
  'Registered','Not Registered','Pending Registration',
  'Exempt','Under Review','Expired','Renewal Due'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE client_type AS ENUM ('Individual','Company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE duration_unit AS ENUM ('Days','Weeks','Months','Years');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE paid_by_option AS ENUM (
  'Developer','Real Estate Company','Agent','Client','Other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SHARED TRIGGER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CORE UNITS TABLES  (001_initial_schema)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS units (
  id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  realtor_name         TEXT            NOT NULL,
  realtor_moci         TEXT            NOT NULL,
  property             TEXT            NOT NULL,
  unit_no              TEXT            NOT NULL,
  zone_code            INTEGER         NOT NULL,
  zone                 TEXT            NOT NULL,
  type                 unit_type       NOT NULL,
  config               TEXT            NOT NULL,
  bathrooms            NUMERIC(3,1)    NOT NULL CHECK (bathrooms >= 0),
  parking              BOOLEAN         NOT NULL DEFAULT false,
  kitchen              kitchen_type    NOT NULL,
  furnishing           furnishing_type NOT NULL,
  listing_type         listing_type    NOT NULL DEFAULT 'Rent',
  status               unit_status     NOT NULL DEFAULT 'Available',
  rent                 NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (rent >= 0),
  service_charges      NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (service_charges >= 0),
  deposit_amount       NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  agency_fee           NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (agency_fee >= 0),
  moci_contract_number TEXT,
  legal_duration       TEXT,
  contract_start_date  DATE,
  contract_end_date    DATE,
  location_map_url     TEXT,
  media_url            TEXT,
  asset_history_links  TEXT[]          NOT NULL DEFAULT '{}',
  listed_date          DATE,
  created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT units_contract_dates CHECK (
    contract_end_date IS NULL OR contract_start_date IS NULL
    OR contract_end_date >= contract_start_date
  )
);

-- Columns added after initial schema
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS kahramaa_applicable   BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS kahramaa_amount       NUMERIC(12,2) DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS qatar_cool_applicable BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS qatar_cool_amount     NUMERIC(12,2) DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS marafeq_applicable    BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS marafeq_amount        NUMERIC(12,2) DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS moci_contract_status  TEXT,
  ADD COLUMN IF NOT EXISTS unit_code             TEXT,
  ADD COLUMN IF NOT EXISTS amenities             TEXT[]        DEFAULT '{}';

DROP TRIGGER IF EXISTS units_updated_at ON units;
CREATE TRIGGER units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── unit_commissions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unit_commissions (
  id                    UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID                NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  agency_fee_applicable BOOLEAN             NOT NULL DEFAULT false,
  agency_fee_amount     NUMERIC(12,2)       CHECK (agency_fee_amount >= 0),
  paid_by               paid_by_option,
  paid_by_other         TEXT,
  property_reg_status   property_reg_status NOT NULL DEFAULT 'Not Registered',
  registration_by       TEXT,
  duration_value        INTEGER             CHECK (duration_value > 0),
  duration_unit         duration_unit,
  created_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  UNIQUE (unit_id)
);

DROP TRIGGER IF EXISTS unit_commissions_updated_at ON unit_commissions;
CREATE TRIGGER unit_commissions_updated_at
  BEFORE UPDATE ON unit_commissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── unit_clients ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unit_clients (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  client_type           client_type   NOT NULL DEFAULT 'Individual',
  full_name             TEXT,
  qid_cr_number         TEXT,
  nationality           TEXT,
  mobile_number         TEXT,
  email                 TEXT,
  employer              TEXT,
  authorized_signatory  TEXT,
  emergency_contact     TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (unit_id)
);

DROP TRIGGER IF EXISTS unit_clients_updated_at ON unit_clients;
CREATE TRIGGER unit_clients_updated_at
  BEFORE UPDATE ON unit_clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── unit_documents ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unit_documents (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  doc_type     TEXT          NOT NULL,
  file_name    TEXT          NOT NULL,
  file_size    INTEGER       CHECK (file_size > 0),
  storage_path TEXT          NOT NULL,
  public_url   TEXT,
  uploaded_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  uploaded_by  UUID          REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── unit_operational ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unit_operational (
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

DROP TRIGGER IF EXISTS unit_operational_updated_at ON unit_operational;
CREATE TRIGGER unit_operational_updated_at
  BEFORE UPDATE ON unit_operational
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── audit_log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID          NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  field        TEXT          NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_by   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Columns added in 20240101_audit_log_columns
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS action_type  TEXT,
  ADD COLUMN IF NOT EXISTS operator     TEXT,
  ADD COLUMN IF NOT EXISTS tab_context  TEXT,
  ADD COLUMN IF NOT EXISTS payload      JSONB DEFAULT '{}';

UPDATE audit_log SET action_type = 'RECORD_SAVE', operator = 'Administrator'
WHERE action_type IS NULL;

-- ── unit_neighborhood  (20240104) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unit_neighborhood (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_uuid      UUID        UNIQUE,
  zone_code      INTEGER     NOT NULL,
  is_zone_level  BOOLEAN     NOT NULL DEFAULT FALSE,
  lifestyle_data JSONB       NOT NULL DEFAULT '[]'::jsonb,
  parks_data     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  commute_data   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unit_neighborhood_zone_idx
  ON unit_neighborhood (zone_code) WHERE is_zone_level = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORE INDEXES (units cluster)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_units_status       ON units (status);
CREATE INDEX IF NOT EXISTS idx_units_type         ON units (type);
CREATE INDEX IF NOT EXISTS idx_units_zone         ON units (zone);
CREATE INDEX IF NOT EXISTS idx_units_realtor      ON units (realtor_name);
CREATE INDEX IF NOT EXISTS idx_units_config       ON units (config);
CREATE INDEX IF NOT EXISTS idx_units_rent         ON units (rent);
CREATE INDEX IF NOT EXISTS idx_units_listed_date  ON units (listed_date DESC);
CREATE INDEX IF NOT EXISTS idx_unit_documents_unit ON unit_documents (unit_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_unit      ON audit_log (unit_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_time      ON audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_unit_id
  ON audit_log (unit_id, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'units','unit_commissions','unit_clients',
    'unit_documents','unit_operational','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        'authenticated_full_access_' || tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CODE REGISTRY  (20240105 + 20240106 + 20240108 + 20240108b + 20240109)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cr_property_type_configs (
  type_code            VARCHAR(2)   PRIMARY KEY,
  core_type            VARCHAR(50)  NOT NULL,
  sub_type             VARCHAR(100) NOT NULL,
  configuration        VARCHAR(50)  NOT NULL,
  integration_scenario VARCHAR(100),
  features             TEXT
);

ALTER TABLE cr_property_type_configs
  ADD COLUMN IF NOT EXISTS category VARCHAR(1) NOT NULL DEFAULT 'R'
  CHECK (category IN ('C','R'));

CREATE TABLE IF NOT EXISTS cr_entity_codes (
  entity_code    VARCHAR(3)   PRIMARY KEY,
  company_name   VARCHAR(250) NOT NULL,
  classification VARCHAR(100),
  is_manual      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cr_agents (
  agent_code VARCHAR(2)   PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS cr_zone_codes (
  zone_code     INTEGER      PRIMARY KEY,
  district_name VARCHAR(150) NOT NULL,
  municipality  VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS cr_sequence_counters (
  prefix   VARCHAR(10) PRIMARY KEY,
  next_seq INTEGER     NOT NULL DEFAULT 299
);

CREATE TABLE IF NOT EXISTS cr_registry (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  smart_code      VARCHAR(14)  UNIQUE NOT NULL,
  type_code       VARCHAR(2)   NOT NULL REFERENCES cr_property_type_configs(type_code),
  entity_code     VARCHAR(3)   NOT NULL REFERENCES cr_entity_codes(entity_code),
  agent_code      VARCHAR(2)   NOT NULL REFERENCES cr_agents(agent_code),
  zone_code       INTEGER      NOT NULL REFERENCES cr_zone_codes(zone_code),
  sequence_number INTEGER      NOT NULL,
  building_name   VARCHAR(200),
  floor_ref       VARCHAR(20),
  unit_ref        VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT cr_smart_code_length CHECK (LENGTH(smart_code) = 14)
);

ALTER TABLE cr_registry
  ADD COLUMN IF NOT EXISTS category VARCHAR(1) NOT NULL DEFAULT 'R'
  CHECK (category IN ('C','R'));

ALTER TABLE cr_registry
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Active';

ALTER TABLE cr_registry
  DROP CONSTRAINT IF EXISTS cr_registry_status_check;
ALTER TABLE cr_registry
  ADD CONSTRAINT cr_registry_status_check
  CHECK (status IN ('Active','Closed','Cancelled','Archived'));

CREATE TABLE IF NOT EXISTS cr_registry_history (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  registry_id UUID         NOT NULL REFERENCES cr_registry(id) ON DELETE CASCADE,
  smart_code  VARCHAR(14)  NOT NULL,
  from_status VARCHAR(20),
  to_status   VARCHAR(20)  NOT NULL,
  changed_by  VARCHAR(100) NOT NULL DEFAULT 'Administrator',
  changed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS cr_registry_type_idx    ON cr_registry (type_code);
CREATE INDEX IF NOT EXISTS cr_registry_entity_idx  ON cr_registry (entity_code);
CREATE INDEX IF NOT EXISTS cr_registry_agent_idx   ON cr_registry (agent_code);
CREATE INDEX IF NOT EXISTS cr_registry_zone_idx    ON cr_registry (zone_code);
CREATE INDEX IF NOT EXISTS cr_registry_created_idx ON cr_registry (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_history_registry_id ON cr_registry_history (registry_id);
CREATE INDEX IF NOT EXISTS idx_cr_history_changed_at  ON cr_registry_history (changed_at DESC);

-- Smart code generation function (v2 — with category prefix)
DROP FUNCTION IF EXISTS cr_generate_smart_code(text,text,text,integer,text,text,text,text);
CREATE OR REPLACE FUNCTION cr_generate_smart_code(
  p_type_code     TEXT,
  p_entity_code   TEXT,
  p_agent_code    TEXT,
  p_zone_code     INTEGER,
  p_building_name TEXT DEFAULT NULL,
  p_floor_ref     TEXT DEFAULT NULL,
  p_unit_ref      TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
) RETURNS TABLE(smart_code TEXT, sequence_number INTEGER, category TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_category    TEXT;
  v_zone_padded TEXT;
  v_prefix      TEXT;
  v_seq         INTEGER;
  v_code        TEXT;
BEGIN
  SELECT c.category INTO v_category
  FROM cr_property_type_configs c WHERE c.type_code = p_type_code;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'Unknown type_code: %', p_type_code;
  END IF;

  v_zone_padded := LPAD(p_zone_code::TEXT, 2, '0');
  v_prefix      := v_category || p_type_code || p_entity_code || p_agent_code || v_zone_padded;

  INSERT INTO cr_sequence_counters (prefix, next_seq)
  VALUES (v_prefix, 1) ON CONFLICT (prefix) DO NOTHING;

  SELECT cs.next_seq INTO v_seq
  FROM cr_sequence_counters cs WHERE cs.prefix = v_prefix FOR UPDATE;

  UPDATE cr_sequence_counters SET next_seq = next_seq + 1
  WHERE cr_sequence_counters.prefix = v_prefix;

  v_code := v_prefix || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO cr_registry (
    smart_code, category, type_code, entity_code, agent_code, zone_code,
    sequence_number, building_name, floor_ref, unit_ref, notes
  ) VALUES (
    v_code, v_category, p_type_code, p_entity_code, p_agent_code, p_zone_code,
    v_seq, p_building_name, p_floor_ref, p_unit_ref, p_notes
  );

  RETURN QUERY SELECT v_code, v_seq, v_category;
END;
$$;

-- Registry full view (final version — includes category + status)
DROP VIEW IF EXISTS cr_registry_full;
CREATE VIEW cr_registry_full AS
SELECT
  r.id, r.smart_code, r.category, r.status,
  r.type_code, p.core_type, p.sub_type, p.configuration, p.integration_scenario,
  r.entity_code, e.company_name, e.classification, e.is_manual,
  r.agent_code, a.full_name AS agent_name,
  r.zone_code, z.district_name, z.municipality,
  r.sequence_number, r.building_name, r.floor_ref, r.unit_ref, r.notes, r.created_at
FROM cr_registry r
JOIN cr_property_type_configs p ON r.type_code   = p.type_code
JOIN cr_entity_codes          e ON r.entity_code  = e.entity_code
JOIN cr_agents                a ON r.agent_code   = a.agent_code
JOIN cr_zone_codes            z ON r.zone_code    = z.zone_code;

-- Seed initial history for any existing registry rows without history
INSERT INTO cr_registry_history (registry_id, smart_code, from_status, to_status, changed_by, notes)
SELECT id, smart_code, NULL, 'Active', 'System', 'Initial Active status assigned on schema migration'
FROM cr_registry
WHERE id NOT IN (SELECT registry_id FROM cr_registry_history);

-- Seed: Property Type Configs (Residential)
INSERT INTO cr_property_type_configs (type_code, core_type, sub_type, configuration, integration_scenario, features, category) VALUES
  ('ST','Apartment','Standard Apartment (Flat)','Studio','Residential Tower / Block','Open-plan kitchen/living space.','R'),
  ('1B','Apartment','Standard Apartment (Flat)','1 BHK','Residential Tower / Block','One separate bedroom with independent hall/living area and kitchen.','R'),
  ('2B','Apartment','Standard Apartment (Flat)','2 BHK','Residential Tower / Block','Two bedrooms, standard living hall.','R'),
  ('3B','Apartment','Standard Apartment (Flat)','3 BHK','Premium High-Rise Tower','Three separate bedrooms.','R'),
  ('4B','Apartment','Standard Apartment (Flat)','4+ BHK','Premium High-Rise Tower','Large-format family flats.','R'),
  ('S0','Apartment','Serviced / Hotel Apartment','Studio','Luxury Hospitality Tower','Fully bundled hospitality units.','R'),
  ('S1','Apartment','Serviced / Hotel Apartment','1 BHK','Luxury Hospitality Tower','Furnished executive corporate suites.','R'),
  ('S2','Apartment','Serviced / Hotel Apartment','2 BHK','Luxury Hospitality Tower','Premium mid-size corporate serviced flats.','R'),
  ('S3','Apartment','Serviced / Hotel Apartment','3 BHK','Luxury Hospitality Tower','Large family-format hotel suites.','R'),
  ('P3','Apartment','Penthouse','3 BHK','Tower Crown / Top Floors','High-end layout on highest floors.','R'),
  ('P4','Apartment','Penthouse','4 BHK','Tower Crown / Top Floors','Expansive elite layout.','R'),
  ('P5','Apartment','Penthouse','5+ BHK','Tower Crown / Top Floors','Ultra-luxury massive footprint units.','R'),
  ('D2','Apartment','Duplex','2 BHK','Multi-Level Tower Unit','Two-story configuration.','R'),
  ('D3','Apartment','Duplex','3 BHK','Multi-Level Tower Unit','Townhouse feel within a premium tower.','R'),
  ('V0','Apartment','Villa Apartment','Studio','Partitioned Independent Villa','Self-contained room within a villa.','R'),
  ('V1','Apartment','Villa Apartment','1 BHK','Partitioned Independent Villa','Separate section of a large villa.','R'),
  ('V2','Apartment','Villa Apartment','2 BHK','Partitioned Independent Villa','Multi-room villa partition.','R'),
  ('LF','Apartment','Loft','1 BHK','Urban Double-Height Space','Industrial-style open plan with mezzanine.','R'),
  ('A3','Villa','Stand-Alone Villa','3 BHK','Independent Private Plot','Fully detached villa.','R'),
  ('A4','Villa','Stand-Alone Villa','4 BHK','Independent Private Plot','Detached private layout.','R'),
  ('A5','Villa','Stand-Alone Villa','5 BHK','Independent Private Plot','Spacious luxury layout.','R'),
  ('A6','Villa','Stand-Alone Villa','6+ BHK','Independent Private Plot','Grand high-capacity layout.','R'),
  ('C3','Villa','Compound Villa','3 BHK','Gated Residential Complex','Villas in a secured boundary.','R'),
  ('C4','Villa','Compound Villa','4 BHK','Gated Residential Complex','Mid-size family compound option.','R'),
  ('C5','Villa','Compound Villa','5+ BHK','Gated Residential Complex','Large premium compound villa.','R'),
  ('T2','Villa','Townhouse','2 BHK','Planned Master Community','Compact row development.','R'),
  ('T3','Villa','Townhouse','3 BHK','Planned Master Community','Multi-story linear attached housing.','R'),
  ('T4','Villa','Townhouse','4 BHK','Planned Master Community','Larger townhouse layout.','R'),
  ('W3','Villa','Twin House','3 BHK','Mirror-Image Semi-Detached','Pair of villas sharing one wall.','R'),
  ('W4','Villa','Twin House','4 BHK','Mirror-Image Semi-Detached','Semi-detached mirror properties.','R'),
  ('MR','System Add-On','Room Filter Extension','+ Maid''s Room','En-Suite Suite Integration','Auxiliary domestic room.','R'),
  ('DR','System Add-On','Room Filter Extension','+ Driver''s Room','External / Garage Plot','Detached room near parking.','R'),
  ('SO','System Add-On','Room Filter Extension','+ Study / Office','Flexible Workspace Alcove','Compact utility room for remote work.','R')
ON CONFLICT (type_code) DO NOTHING;

-- Seed: Commercial Types (Office, Retail, Warehouse)
INSERT INTO cr_property_type_configs (type_code, core_type, sub_type, configuration, integration_scenario, features, category) VALUES
  ('OO','Office','Open Plan Office','Open Layout','Business Tower / Commercial Hub','Flexible open-plan workspace.','C'),
  ('OP','Office','Partitioned Office','Partitioned Layout','Business Tower / Commercial Hub','Pre-divided private office rooms.','C'),
  ('OE','Office','Executive Suite','Fitted Suite','Premium Grade-A Tower','Fully fitted serviced executive office.','C'),
  ('OC','Office','Co-working Space','Shared Desk','Managed Flexible Workspace','Hot-desking and private pod options.','C'),
  ('OB','Office','Business Centre','Full Floor','Premium Grade-A Tower','Full floor in a managed business centre.','C'),
  ('RG','Retail','Ground Floor Retail','Street Facing','Mixed-Use Commercial Podium','High-visibility street-level unit.','C'),
  ('RM','Retail','Mall Unit','Inline Unit','Enclosed Shopping Mall','Standard inline retail unit.','C'),
  ('RA','Retail','Mall Unit','Anchor / Corner','Enclosed Shopping Mall','Premium high-footfall corner position.','C'),
  ('RS','Retail','Showroom','Large Format','Automotive / Furniture Strip','Large-format ground-level showroom.','C'),
  ('RF','Retail','F&B Unit','Restaurant / Café','F&B Strip / Food Court','Dedicated food and beverage unit.','C'),
  ('RK','Retail','Kiosk','Standalone Kiosk','Mall Concourse / Open Area','Compact standalone kiosk.','C'),
  ('WS','Warehouse','Standard Warehouse','Open Bay','Industrial Zone / Logistics Park','Single or multi-bay open warehouse.','C'),
  ('WT','Warehouse','Temperature Controlled','Cold Store','Logistics & Cold Chain Facility','Refrigerated or frozen storage unit.','C'),
  ('WL','Warehouse','Light Industrial','Workshop / Unit','Industrial Estate','Combined office-and-workshop unit.','C'),
  ('WM','Warehouse','Mixed Use Industrial','Showroom + Store','Commercial Industrial','Showroom fronting a rear warehouse.','C'),
  ('SH','Showroom','Automotive Showroom','Car Dealership','Automotive Strip / Boulevard','Purpose-built car dealership showroom.','C'),
  ('SF','Showroom','Furniture Showroom','Large Format','Furniture & Home Retail Strip','Large-format furniture showroom.','C'),
  ('SE','Showroom','Electronics Showroom','Branded Outlet','Tech & Electronics District','Branded electronics showroom.','C'),
  ('SK','Showroom','Fashion Showroom','Boutique / Studio','Fashion & Lifestyle Strip','Boutique-style fashion showroom.','C'),
  ('SG','Showroom','General Showroom','Open Format','Mixed Commercial Strip','Flexible open-plan showroom.','C'),
  ('SM','Showroom','Mixed Use Showroom','Showroom + Office','Commercial Mixed Use','Showroom with integrated office.','C')
ON CONFLICT (type_code) DO NOTHING;

-- Seed: Entity Codes
INSERT INTO cr_entity_codes (entity_code, company_name, classification, is_manual) VALUES
  ('QDR','Qatari Diar Real Estate Investment Company','Semi-Government & Master Developer',FALSE),
  ('UDC','United Development Company (UDC)','Semi-Government & Master Developer',FALSE),
  ('BWA','Barwa Real Estate Group','Semi-Government & Master Developer',FALSE),
  ('MSH','Mshereheb Properties','Semi-Government & Master Developer',FALSE),
  ('EZD','Ezdan Holding Group','Semi-Government & Master Developer',FALSE),
  ('MAZ','Mazaya Real Estate Development','Semi-Government & Master Developer',FALSE),
  ('ALF','Alfardan Properties','Elite Private Developer & Conglomerate',FALSE),
  ('ASM','Al Asmakh Real Estate Development','Elite Private Developer & Conglomerate',FALSE),
  ('AEM','Al Emadi Enterprises','Elite Private Developer & Conglomerate',FALSE),
  ('AAM','Aamal Company QSC','Elite Private Developer & Conglomerate',FALSE),
  ('AMN','Al Mana Real Estate','Elite Private Developer & Conglomerate',FALSE),
  ('EST','Estithmar Holding','Elite Private Developer & Conglomerate',FALSE),
  ('DAA','Dar Al Arkan Qataria','Elite Private Developer & Conglomerate',FALSE),
  ('JMJ','JMJ Group Holding','Elite Private Developer & Conglomerate',FALSE),
  ('AMD','Al Madar Holding','Elite Private Developer & Conglomerate',FALSE),
  ('BAS','Bin Al-Sheikh Holding','Elite Private Developer & Conglomerate',FALSE),
  ('LFB','The Loft Bureau Real Estate','Top International & Local Brokerage',FALSE),
  ('NPP','NelsonPark Property','Top International & Local Brokerage',FALSE),
  ('BTH','Betterhomes Qatar','Top International & Local Brokerage',FALSE),
  ('FGR','FGREALTY Qatar','Top International & Local Brokerage',FALSE),
  ('TPG','The Pearl Gates','Top International & Local Brokerage',FALSE),
  ('CAP','Capstone Property','Top International & Local Brokerage',FALSE),
  ('STP','Steps Real Estate','Top International & Local Brokerage',FALSE),
  ('ABH','ABH Real Estate','Top International & Local Brokerage',FALSE),
  ('25S','25 Spaces Real Estate','Top International & Local Brokerage',FALSE),
  ('COR','Coreo Real Estate','Top International & Local Brokerage',FALSE),
  ('DIR','Direct Real Estate','Top International & Local Brokerage',FALSE),
  ('CRQ','Corporate Real Estate Qatar','Top International & Local Brokerage',FALSE),
  ('GKR','Golden Key Real Estate','Top International & Local Brokerage',FALSE),
  ('MRH','Maroon Homes','Top International & Local Brokerage',FALSE),
  ('PPQ','Premium Property Qatar','Top International & Local Brokerage',FALSE),
  ('DNQ','Danat Qatar','Institutional Property Manager',FALSE),
  ('AJR','Al Jazi Real Estate (Al Faisal Holding)','Institutional Property Manager',FALSE),
  ('UCR','Unicorn Real Estate','Institutional Property Manager',FALSE),
  ('MIG','Mirage International Property Consultants (MIPC)','Institutional Property Manager',FALSE),
  ('C1R','Capital One Real Estate','Institutional Property Manager',FALSE),
  ('RLQ','Realty Qatar','Institutional Property Manager',FALSE),
  ('ZRC','Zircon Real Estate','Institutional Property Manager',FALSE)
ON CONFLICT (entity_code) DO NOTHING;

-- Seed: Core Agents
INSERT INTO cr_agents (agent_code, full_name) VALUES
  ('AA','Ahmed Ali'),
  ('AS','Abdul Shahan'),
  ('FM','Fazlue Mushaffik'),
  ('SB','Shihan Buhary'),
  ('NL','Nadeem Leeman')
ON CONFLICT (agent_code) DO NOTHING;

-- Seed: Zone Codes (90 Qatar zones)
INSERT INTO cr_zone_codes (zone_code, district_name, municipality) VALUES
  (1,'Al Jasrah','Doha Municipality'),(2,'Al Bidda','Doha Municipality'),
  (3,'Fereej Mohamed Bin Jassim / Musheireb','Doha Municipality'),
  (4,'Musheireb','Doha Municipality'),(5,'Al Najada / Barahat Al Jufairi','Doha Municipality'),
  (6,'Old Al Ghanim','Doha Municipality'),(7,'Al Souq','Doha Municipality'),
  (10,'Wadi Al Sail','Doha Municipality'),(11,'Rumeilah','Doha Municipality'),
  (12,'Al Bidda','Doha Municipality'),(13,'Musheireb','Doha Municipality'),
  (14,'Fereej Abdel Aziz','Doha Municipality'),(15,'Doha Al Jadeeda','Doha Municipality'),
  (16,'Old Al Ghanim','Doha Municipality'),(17,'Old Al Hitmi','Doha Municipality'),
  (18,'As Salatah / Al Mirqab','Doha Municipality'),(19,'Doha Port','Doha Municipality'),
  (20,'Wadi Al Sail','Doha Municipality'),(21,'Rumeilah','Doha Municipality'),
  (22,'Fereej Bin Mahmoud','Doha Municipality'),(23,'Fereej Bin Mahmoud','Doha Municipality'),
  (24,'Rawdat Al Khail','Doha Municipality'),(25,'Al Mansoura / Bin Dirham','Doha Municipality'),
  (26,'Najma','Doha Municipality'),(27,'Umm Ghuwailina','Doha Municipality'),
  (28,'Ras Abu Aboud / Al Khulaifat','Doha Municipality'),
  (30,'Duhail','Doha Municipality'),(31,'Umm Lekhba','Doha Municipality'),
  (32,'Madinat Khalifa North / Dahl Al Hamam','Doha Municipality'),
  (33,'Al Markhiya','Doha Municipality'),(34,'Madinat Khalifa South','Doha Municipality'),
  (35,'Fereej Kulaib','Doha Municipality'),(36,'Al Messila','Doha Municipality'),
  (37,'Bin Omran / Hamad Medical City','Doha Municipality'),
  (38,'Al Sadd','Doha Municipality'),
  (39,'Al Sadd / New Al Mirqab / Fereej Al Nasr','Doha Municipality'),
  (40,'New Salata','Doha Municipality'),(41,'Nuaija','Doha Municipality'),
  (42,'Al Hilal','Doha Municipality'),(43,'Nuaija','Doha Municipality'),
  (44,'Nuaija','Doha Municipality'),(45,'Old Airport','Doha Municipality'),
  (46,'Al Thumama','Doha Municipality'),(47,'Al Thumama','Doha Municipality'),
  (48,'Doha International Airport','Doha Municipality'),(49,'Airport Area','Doha Municipality'),
  (50,'Zone 50','Doha Municipality'),(51,'Abu Hamour','Al Rayyan Municipality'),
  (52,'Muaither','Al Rayyan Municipality'),(53,'Al Waab','Al Rayyan Municipality'),
  (54,'Al Rayyan Al Jadeed','Al Rayyan Municipality'),
  (55,'Fereej Al Amir','Al Rayyan Municipality'),(56,'Ain Khaled','Al Rayyan Municipality'),
  (57,'Industrial Area','Doha Municipality'),(58,'Zone 58','Doha Municipality'),
  (60,'Al Dafna','Doha Municipality'),(61,'Al Dafna / Al Qassar','Doha Municipality'),
  (63,'Onaiza','Doha Municipality'),(64,'Lejbailat','Doha Municipality'),
  (65,'Onaiza','Doha Municipality'),
  (66,'Legtaifiya / Al Qassar / Onaiza','Doha Municipality'),
  (67,'Hazm Al Markhiya','Doha Municipality'),(68,'Jelaiah / Al Tarfa','Doha Municipality'),
  (69,'Lusail / Jabal Thuaileb / Al Kharayej','Al Daayen Municipality'),
  (70,'Umm Qarn / Simaisma Areas','Al Daayen Municipality'),
  (71,'Umm Salal Mohammed / Umm Salal Ali','Umm Salal Municipality'),
  (72,'Al Shahaniya','Al Shahaniya Municipality'),(73,'Dukhan','Al Shahaniya Municipality'),
  (74,'Al Khor','Al Khor & Al Thakhira Municipality'),
  (75,'Al Thakhira','Al Khor & Al Thakhira Municipality'),
  (76,'Ras Laffan','Al Khor & Al Thakhira Municipality'),
  (77,'Madinat Ash Shamal','Al Shamal Municipality'),
  (78,'Ar Ruwais','Al Shamal Municipality'),
  (79,'Abu Dhalouf / Al Zubarah','Al Shamal Municipality'),
  (80,'Al Jemailiya','Al Shahaniya Municipality'),
  (81,'Gharrafat Al Rayyan','Al Rayyan Municipality'),
  (82,'Rawdat Rashed','Al Shahaniya Municipality'),
  (83,'Bani Hajer','Al Rayyan Municipality'),(84,'Mukaynis','Al Shahaniya Municipality'),
  (85,'Umm Bab Areas','Al Shahaniya Municipality'),
  (86,'Remote Western Areas','Al Shahaniya Municipality'),
  (90,'Al Wakrah','Al Wakrah Municipality'),(91,'Al Wukair','Al Wakrah Municipality'),
  (92,'Mesaieed','Al Wakrah Municipality'),
  (93,'Sealine / Mesaieed South','Al Wakrah Municipality'),
  (94,'Al Karaana','Al Wakrah Municipality'),
  (95,'Al Adaid (Inland Sea)','Al Wakrah Municipality'),
  (96,'Abu Samra','Al Rayyan Municipality'),
  (97,'Umm Bab / Remote Areas','Al Rayyan Municipality')
ON CONFLICT (zone_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SYNERGY CENTER  (20240110 + 20240111)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inquiries (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_no          TEXT         UNIQUE,
  client_name     TEXT         NOT NULL,
  client_phone    TEXT,
  client_email    TEXT,
  client_nationality TEXT,
  source          TEXT         CHECK (source IN ('Walk-in','WhatsApp','Website','Referral','Bayut','Property Finder','Phone','Other')),
  listing_type    TEXT         CHECK (listing_type IN ('Rent','Sale')),
  property_type   TEXT,
  config          TEXT,
  bathrooms_min   NUMERIC,
  budget_min      NUMERIC,
  budget_max      NUMERIC,
  preferred_zones TEXT[],
  furnishing      TEXT,
  status          TEXT         NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','contacted','viewing','negotiating','won','lost')),
  assigned_agent  TEXT,
  follow_up_date  DATE,
  notes           TEXT,
  last_matched_at TIMESTAMPTZ,
  match_count     INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- assigned_unit_id — 20240111
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS assigned_unit_id UUID
    REFERENCES units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inq_status           ON inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inq_agent            ON inquiries (assigned_agent);
CREATE INDEX IF NOT EXISTS idx_inq_created          ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_unit_id
  ON inquiries (assigned_unit_id) WHERE assigned_unit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_inquiry_ref_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ym   TEXT := to_char(now(), 'YYYYMM');
  seq  INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(ref_no, '-', 3) AS INT)), 0) + 1
    INTO seq FROM inquiries WHERE ref_no LIKE 'INQ-' || ym || '-%';
  NEW.ref_no := 'INQ-' || ym || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiry_ref_no ON inquiries;
CREATE TRIGGER trg_inquiry_ref_no
  BEFORE INSERT ON inquiries
  FOR EACH ROW WHEN (NEW.ref_no IS NULL)
  EXECUTE FUNCTION set_inquiry_ref_no();

DROP TRIGGER IF EXISTS trg_inquiry_updated ON inquiries;
CREATE TRIGGER trg_inquiry_updated
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS inquiry_matches (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id     UUID         NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  unit_id        UUID,
  unit_code      TEXT,
  unit_snapshot  JSONB        NOT NULL,
  match_tier     INT          NOT NULL CHECK (match_tier IN (1,2,3)),
  match_score    NUMERIC(5,2) NOT NULL,
  match_reasons  JSONB        NOT NULL,
  is_shortlisted BOOLEAN      NOT NULL DEFAULT false,
  shortlisted_at TIMESTAMPTZ,
  shortlisted_by TEXT,
  computed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (inquiry_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_match_inquiry   ON inquiry_matches (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_match_shortlist ON inquiry_matches (is_shortlisted);
CREATE INDEX IF NOT EXISTS idx_match_tier      ON inquiry_matches (match_tier);

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  type           TEXT         NOT NULL
                              CHECK (type IN ('new_match','unit_blocked','new_inquiry','daily_digest','follow_up')),
  title          TEXT         NOT NULL,
  body           TEXT,
  inquiry_id     UUID         REFERENCES inquiries(id) ON DELETE SET NULL,
  unit_id        UUID,
  assigned_agent TEXT,
  is_read        BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_read    ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_agent   ON notifications (assigned_agent);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. GRANTS  (all tables + sequences + functions)
-- ─────────────────────────────────────────────────────────────────────────────

GRANT ALL ON TABLE public.units              TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.unit_commissions   TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.unit_clients       TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.unit_documents     TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.unit_operational   TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.audit_log          TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.unit_neighborhood  TO service_role, authenticated, anon;

GRANT ALL ON TABLE public.cr_property_type_configs TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.cr_entity_codes          TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.cr_agents                TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.cr_zone_codes            TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.cr_sequence_counters     TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.cr_registry              TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.cr_registry_history      TO service_role, authenticated, anon;
GRANT ALL ON        public.cr_registry_full        TO service_role, authenticated, anon;

GRANT ALL ON TABLE public.inquiries        TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.inquiry_matches  TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.notifications    TO service_role, authenticated, anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION cr_generate_smart_code TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION set_inquiry_ref_no     TO service_role, authenticated, anon;
