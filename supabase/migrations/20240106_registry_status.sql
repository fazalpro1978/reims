-- ─────────────────────────────────────────────────────────────────────────────
-- Code Registry — Status column + History audit table
-- Run once in Supabase Dashboard → SQL Editor (Production project)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add status column to cr_registry
ALTER TABLE cr_registry
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Active';

ALTER TABLE cr_registry
  DROP CONSTRAINT IF EXISTS cr_registry_status_check;

ALTER TABLE cr_registry
  ADD CONSTRAINT cr_registry_status_check
  CHECK (status IN ('Active', 'Closed', 'Cancelled', 'Archived'));

-- 2. Audit history table
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

CREATE INDEX IF NOT EXISTS idx_cr_history_registry_id
  ON cr_registry_history(registry_id);

CREATE INDEX IF NOT EXISTS idx_cr_history_changed_at
  ON cr_registry_history(changed_at DESC);

-- 3. Seed initial history for any existing registry rows
INSERT INTO cr_registry_history
  (registry_id, smart_code, from_status, to_status, changed_by, notes)
SELECT
  id, smart_code, NULL, 'Active', 'System',
  'Initial Active status assigned on schema migration'
FROM cr_registry
WHERE id NOT IN (SELECT registry_id FROM cr_registry_history);

-- 4. Rebuild cr_registry_full view to include status
DROP VIEW IF EXISTS cr_registry_full;
CREATE VIEW cr_registry_full AS
SELECT
  r.id, r.smart_code, r.status,
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

-- 5. Grants
GRANT ALL ON cr_registry_history TO service_role, anon, authenticated;
GRANT ALL ON cr_registry_full    TO service_role, anon, authenticated;
