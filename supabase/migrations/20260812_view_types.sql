-- 37-item Property View Types classification for units
-- Stored as a validated text[] on the units table.
-- Each element must be one of the canonical view options (alphabetical).

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS view_types text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_view_types_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_view_types_check
  CHECK (
    view_types <@ ARRAY[
      'Beach View','Canal View','City View','Clubhouse View','Community View',
      'Countryside View','Courtyard View','Desert View','Downtown View',
      'Garden View','Golf Course View','Greenery View','Lake View','Lagoon View',
      'Landmark View','Main Road View','Marina View','Mountain View','Nature View',
      'Neighbourhood View','Ocean View','Open View','Panoramic View','Park View',
      'Partial View','Playground View','Pool View','River View','Sea View',
      'Skyline View','Sports View','Street View','Sunrise View','Sunset View',
      'Swimming Pool View','Unobstructed View','Waterfront View'
    ]::text[]
  );

-- Index for future filter/search queries on view types
CREATE INDEX IF NOT EXISTS idx_units_view_types ON public.units USING gin(view_types);
