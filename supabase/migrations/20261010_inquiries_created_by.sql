-- Strict audit-trail separation: creator ≠ current handler.
-- created_by_name / created_by_email are set once at INSERT and never updated.
-- staff_name / staff_email continue to track the current handler assignment.
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS created_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

-- Back-fill: for existing rows, treat the original staff member as the creator.
-- Rows with no staff_email (admin-created with no handler) stay NULL.
UPDATE inquiries
SET
  created_by_name  = staff_name,
  created_by_email = staff_email
WHERE created_by_name IS NULL AND staff_email IS NOT NULL;
