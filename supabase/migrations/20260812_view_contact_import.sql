-- Import-sourced fields for units:
--   view  — single orientation/position descriptor from source document VIEW column
--           (e.g. 'Front View', 'Sea View'). Separate from view_types[] classification.
-- contact_details is parsed server-side into unit_operational.focal_point_name/phone;
-- no column needed on units for contact.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS view text;
