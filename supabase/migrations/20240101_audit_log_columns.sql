-- Migration: add structured columns to audit_log
-- Run this in the Supabase SQL Editor (once only).
-- Safe to re-run: each ALTER uses IF NOT EXISTS.

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS action_type  TEXT,
  ADD COLUMN IF NOT EXISTS operator     TEXT,
  ADD COLUMN IF NOT EXISTS tab_context  TEXT,
  ADD COLUMN IF NOT EXISTS payload      JSONB DEFAULT '{}';

-- Optional: back-fill existing rows with a sentinel action type so the
-- System Log can display them without crashing on NULL action_type.
UPDATE audit_log
SET action_type = 'RECORD_SAVE',
    operator    = 'Administrator'
WHERE action_type IS NULL;

-- Optional index speeds up per-unit log queries (recommended for large tables)
CREATE INDEX IF NOT EXISTS idx_audit_log_unit_id
  ON audit_log (unit_id, created_at DESC);
