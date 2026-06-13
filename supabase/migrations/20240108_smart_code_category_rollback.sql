-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: Smart Code v2 category layer
-- Restores original cr_generate_smart_code function and removes category columns
-- WARNING: only safe to run if no new codes have been generated yet
-- ─────────────────────────────────────────────────────────────────────────────

-- Restore original function (9-char prefix, 5-digit seq, starts at 299)
CREATE OR REPLACE FUNCTION cr_generate_smart_code(
  p_type_code     TEXT,
  p_entity_code   TEXT,
  p_agent_code    TEXT,
  p_zone_code     INTEGER,
  p_building_name TEXT DEFAULT NULL,
  p_floor_ref     TEXT DEFAULT NULL,
  p_unit_ref      TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
) RETURNS TABLE(smart_code TEXT, sequence_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_zone_padded TEXT;
  v_prefix      TEXT;
  v_seq         INTEGER;
  v_code        TEXT;
BEGIN
  v_zone_padded := LPAD(p_zone_code::TEXT, 2, '0');
  v_prefix      := p_type_code || p_entity_code || p_agent_code || v_zone_padded;

  INSERT INTO cr_sequence_counters (prefix, next_seq)
  VALUES (v_prefix, 299)
  ON CONFLICT (prefix) DO NOTHING;

  SELECT cs.next_seq INTO v_seq
  FROM cr_sequence_counters cs
  WHERE cs.prefix = v_prefix
  FOR UPDATE;

  UPDATE cr_sequence_counters
  SET next_seq = next_seq + 1
  WHERE cr_sequence_counters.prefix = v_prefix;

  v_code := v_prefix || LPAD(v_seq::TEXT, 5, '0');

  INSERT INTO cr_registry (
    smart_code, type_code, entity_code, agent_code, zone_code,
    sequence_number, building_name, floor_ref, unit_ref, notes
  ) VALUES (
    v_code, p_type_code, p_entity_code, p_agent_code, p_zone_code,
    v_seq, p_building_name, p_floor_ref, p_unit_ref, p_notes
  );

  RETURN QUERY SELECT v_code, v_seq;
END;
$$;

-- Restore prefix width
ALTER TABLE cr_sequence_counters ALTER COLUMN prefix TYPE VARCHAR(9);

-- Restore view without category
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

-- Remove category columns
ALTER TABLE cr_registry              DROP COLUMN IF EXISTS category;
ALTER TABLE cr_property_type_configs DROP COLUMN IF EXISTS category;
