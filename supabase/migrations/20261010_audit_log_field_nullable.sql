-- Make audit_log.field nullable — field is only meaningful for FIELD_UPDATE events;
-- record-level events (RECORD_VIEW, RECORD_SAVE, TAB_NAVIGATE) have no field name.
ALTER TABLE audit_log ALTER COLUMN field DROP NOT NULL;
