-- ─────────────────────────────────────────────────────────────────────────────
-- Smart Code v2 — Leading category layer (C/R) + 4-digit sequence
-- New format: [1-cat][2-type][3-entity][2-agent][2-zone][4-seq] = 14 chars
-- ADDITIVE ONLY on existing tables.
-- ROLLBACK: execute 20240108_smart_code_category_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add category column to property type configs ───────────────────────────
ALTER TABLE cr_property_type_configs
  ADD COLUMN IF NOT EXISTS category VARCHAR(1) NOT NULL DEFAULT 'R'
  CHECK (category IN ('C','R'));

-- All existing types are Residential
UPDATE cr_property_type_configs SET category = 'R';

-- ── 2. Add category column to registry ───────────────────────────────────────
ALTER TABLE cr_registry
  ADD COLUMN IF NOT EXISTS category VARCHAR(1) NOT NULL DEFAULT 'R'
  CHECK (category IN ('C','R'));

-- Backfill from type config for existing rows
UPDATE cr_registry r
SET category = p.category
FROM cr_property_type_configs p
WHERE r.type_code = p.type_code;

-- ── 3. Widen sequence counter prefix to accommodate category char ─────────────
ALTER TABLE cr_sequence_counters
  ALTER COLUMN prefix TYPE VARCHAR(10);

-- ── 4. Replace smart code generation function ─────────────────────────────────
-- New prefix: category(1) + type(2) + entity(3) + agent(2) + zone(2) = 10 chars
-- New code:   prefix(10) + seq(4) = 14 chars
-- Sequence starts at 0001 per unique prefix combination
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
  -- Resolve category from the type config
  SELECT c.category INTO v_category
  FROM cr_property_type_configs c
  WHERE c.type_code = p_type_code;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'Unknown type_code: %', p_type_code;
  END IF;

  v_zone_padded := LPAD(p_zone_code::TEXT, 2, '0');
  v_prefix      := v_category || p_type_code || p_entity_code || p_agent_code || v_zone_padded;

  -- Initialise counter at 0 for brand-new prefix combinations
  INSERT INTO cr_sequence_counters (prefix, next_seq)
  VALUES (v_prefix, 1)
  ON CONFLICT (prefix) DO NOTHING;

  SELECT cs.next_seq INTO v_seq
  FROM cr_sequence_counters cs
  WHERE cs.prefix = v_prefix
  FOR UPDATE;

  UPDATE cr_sequence_counters
  SET next_seq = next_seq + 1
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

-- ── 5. Rebuild the full view to include category ──────────────────────────────
DROP VIEW IF EXISTS cr_registry_full;
CREATE VIEW cr_registry_full AS
SELECT
  r.id, r.smart_code, r.category,
  r.type_code, p.core_type, p.sub_type, p.configuration, p.integration_scenario,
  r.entity_code, e.company_name, e.classification, e.is_manual,
  r.agent_code, a.full_name AS agent_name,
  r.zone_code, z.district_name, z.municipality,
  r.sequence_number, r.building_name, r.floor_ref, r.unit_ref, r.notes,
  r.status, r.created_at
FROM cr_registry r
JOIN cr_property_type_configs p ON r.type_code   = p.type_code
JOIN cr_entity_codes          e ON r.entity_code  = e.entity_code
JOIN cr_agents                a ON r.agent_code   = a.agent_code
JOIN cr_zone_codes            z ON r.zone_code    = z.zone_code;

-- ── 6. Grants ─────────────────────────────────────────────────────────────────
GRANT ALL ON cr_property_type_configs TO service_role, anon, authenticated;
GRANT ALL ON cr_registry              TO service_role, anon, authenticated;
GRANT ALL ON cr_registry_full         TO service_role, anon, authenticated;
GRANT ALL ON cr_sequence_counters     TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION cr_generate_smart_code TO service_role, anon, authenticated;
