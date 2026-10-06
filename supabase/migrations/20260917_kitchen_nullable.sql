-- Allow kitchen to be null (null = Not Included, matching the Included/Not Included toggle in REIMS
-- and the AXIOM "No" value which maps to null on import).
ALTER TABLE public.units ALTER COLUMN kitchen DROP NOT NULL;
