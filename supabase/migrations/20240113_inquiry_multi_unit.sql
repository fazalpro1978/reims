-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Extends inquiries to support up to 3 assigned units per inquiry.
-- Slot 1 already exists (assigned_unit_id). Slots 2 and 3 added here.
-- All slots are nullable — none are mandatory.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS assigned_unit_id_2 UUID
    REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_unit_id_3 UUID
    REFERENCES public.units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_unit_id_2
  ON public.inquiries (assigned_unit_id_2)
  WHERE assigned_unit_id_2 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_unit_id_3
  ON public.inquiries (assigned_unit_id_3)
  WHERE assigned_unit_id_3 IS NOT NULL;
