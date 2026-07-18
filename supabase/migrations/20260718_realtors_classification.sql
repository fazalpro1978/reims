-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Add classification field to the shared realtors registry.
-- Classifies brokerages into 5 tiers used across REIMS and Axiom.

ALTER TABLE public.realtors
  ADD COLUMN IF NOT EXISTS classification TEXT;
