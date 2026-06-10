-- Migration: add utility deposit columns to units table
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS kahramaa_applicable   BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS kahramaa_amount       NUMERIC(12,2) DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS qatar_cool_applicable BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS qatar_cool_amount     NUMERIC(12,2) DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS marafeq_applicable    BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS marafeq_amount        NUMERIC(12,2) DEFAULT 3000;
