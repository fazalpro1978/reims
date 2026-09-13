-- Migration: add Water & Electricity, Booking Validity, and change deposit defaults
-- Run on: reims-testing (Supabase SQL editor)

-- 1. Change deposit applicable defaults from true → false
ALTER TABLE public.units
  ALTER COLUMN kahramaa_applicable   SET DEFAULT false,
  ALTER COLUMN qatar_cool_applicable SET DEFAULT false,
  ALTER COLUMN marafeq_applicable    SET DEFAULT false;

-- 2. Water & Electricity fields
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS water_electricity                  TEXT    NOT NULL DEFAULT 'Excluded',
  ADD COLUMN IF NOT EXISTS water_electricity_limit_applicable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS water_electricity_limit_amount     NUMERIC(10,2)     DEFAULT NULL;

-- 3. Booking Validity fields
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS booking_validity        TEXT          NOT NULL DEFAULT 'Not Applicable',
  ADD COLUMN IF NOT EXISTS booking_validity_period TEXT                   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS booking_fee             NUMERIC(10,2)          DEFAULT NULL;
