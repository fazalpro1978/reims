CREATE TABLE IF NOT EXISTS unit_neighborhood (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_uuid      UUID        UNIQUE,
  zone_code      INTEGER     NOT NULL,
  is_zone_level  BOOLEAN     NOT NULL DEFAULT FALSE,
  lifestyle_data JSONB       NOT NULL DEFAULT '[]'::jsonb,
  parks_data     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  commute_data   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One zone-level guide per zone code
CREATE UNIQUE INDEX IF NOT EXISTS unit_neighborhood_zone_idx
  ON unit_neighborhood (zone_code)
  WHERE is_zone_level = TRUE;
