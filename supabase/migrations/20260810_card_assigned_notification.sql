-- Add card_assigned to notifications type constraint and add target_user_email column

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_match','unit_blocked','new_inquiry','daily_digest','follow_up','card_assigned'));

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_user_email TEXT;
CREATE INDEX IF NOT EXISTS idx_notif_target_email ON notifications(target_user_email);
