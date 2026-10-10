-- ── Danat Qatar ingest support ───────────────────────────────────────────────
-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
-- Applied manually 2026-10-10 via Supabase SQL Editor.
-- This file documents the applied changes for version control.

-- 1. Add Rowhouse to unit_type enum
--    Required for Danat Qatar AG08 (Abu Hamour) which has a 5 BR Rowhouse unit.
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'Rowhouse';

-- 2. Add rent_ff column to units
--    Stores the Fully Furnished monthly rent when a property offers dual pricing
--    (e.g. The View, Al Dana Tower, Alfardan Residence Al Sadd).
--    The existing rent column holds the Semi-Furnished (lower) price.
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS rent_ff NUMERIC(12,2) DEFAULT NULL CHECK (rent_ff >= 0);

COMMENT ON COLUMN public.units.rent_ff IS
  'Fully Furnished rent (QAR/month). Populated when the property offers both SF and FF pricing. The rent column holds the Semi-Furnished (lower) value.';
