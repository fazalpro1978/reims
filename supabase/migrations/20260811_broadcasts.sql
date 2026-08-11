-- Broadcast messaging engine
-- Immutable audit log + per-user delivery fan-out via notifications table

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id      uuid        NOT NULL,
  sender_name    text        NOT NULL,
  sender_email   text        NOT NULL,
  title          text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body           text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  target_groups  text[]      NOT NULL,
  delivery_count integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_gin     ON public.broadcasts USING gin(target_groups);

-- Add broadcast type to notifications and a FK back to broadcasts
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_match','unit_blocked','new_inquiry','daily_digest','follow_up','card_assigned','broadcast'));

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS broadcast_id uuid
  REFERENCES public.broadcasts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notif_broadcast ON public.notifications(broadcast_id);
