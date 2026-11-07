-- Add map_url to cr_zone_codes for pipeline auto-population of location_map_url.
-- Narrow test: seed zone 69 (Lusail) only.
-- Once verified end-to-end, all zones will be seeded in a follow-up migration.

ALTER TABLE public.cr_zone_codes
  ADD COLUMN IF NOT EXISTS map_url TEXT;

UPDATE public.cr_zone_codes
SET map_url = 'https://www.google.com/maps/place/Lusail,+Qatar'
WHERE zone_code = 69;
