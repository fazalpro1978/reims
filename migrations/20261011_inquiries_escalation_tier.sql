-- Tracks which escalation tier has already been notified per inquiry.
-- Prevents duplicate alert emails when the cron runs every hour.
-- Values: NULL (no alert sent) → 'warn' → 'crit'
-- Reset to NULL automatically when inquiry moves to a terminal status (won/lost/cancelled/closed).

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS escalation_notified_tier TEXT
    CHECK (escalation_notified_tier IN ('warn', 'crit'));

-- Auto-reset when status moves to a terminal state so any future reopen
-- can generate fresh alerts.
CREATE OR REPLACE FUNCTION reset_escalation_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('won', 'lost', 'cancelled', 'closed')
     AND OLD.status NOT IN ('won', 'lost', 'cancelled', 'closed') THEN
    NEW.escalation_notified_tier := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_escalation_tier ON inquiries;
CREATE TRIGGER trg_reset_escalation_tier
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION reset_escalation_tier();
