-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Adds optional email column to cr_agents so assignment notifications
-- can be sent via Resend when a consultant is assigned to an inquiry.

ALTER TABLE public.cr_agents
  ADD COLUMN IF NOT EXISTS email TEXT;
