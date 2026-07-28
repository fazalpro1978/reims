-- Run on Production : hbpxufqrdqaycwovirns
-- Run on Testing    : hsulqoavwmsvffsbzoan
--
-- Adds floor number and size (sqm) columns to units table.
-- Required for dInges Example 7 ingestion (tower-style sheets with Floor and Size Sq. columns).

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS floor    INTEGER,
  ADD COLUMN IF NOT EXISTS size_sqm NUMERIC(8, 2);
