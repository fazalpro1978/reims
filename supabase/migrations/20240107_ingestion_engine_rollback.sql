-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: Ingestion Engine v2
-- Drops all tables added by 20240107_ingestion_engine.sql
-- Safe — zero impact on the units table or any existing data
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER  IF EXISTS trg_unit_version_number ON unit_versions;
DROP FUNCTION IF EXISTS set_unit_version_number();

DROP TABLE IF EXISTS building_aliases  CASCADE;
DROP TABLE IF EXISTS unit_versions     CASCADE;
DROP TABLE IF EXISTS unit_changes      CASCADE;
DROP TABLE IF EXISTS ingestion_records CASCADE;
DROP TABLE IF EXISTS ingestion_runs    CASCADE;
