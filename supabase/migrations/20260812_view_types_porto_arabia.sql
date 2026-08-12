-- Add Porto Arabia View to the view_types check constraint
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_view_types_check;
ALTER TABLE public.units ADD CONSTRAINT units_view_types_check
  CHECK (view_types <@ ARRAY[
    'Beach View','Canal View','City View','Clubhouse View','Community View',
    'Countryside View','Courtyard View','Desert View','Downtown View',
    'Garden View','Golf Course View','Greenery View','Lake View','Lagoon View',
    'Landmark View','Main Road View','Marina View','Mountain View','Nature View',
    'Neighbourhood View','Ocean View','Open View','Panoramic View','Park View',
    'Partial View','Playground View','Pool View','Porto Arabia View','River View',
    'Sea View','Skyline View','Sports View','Street View','Sunrise View',
    'Sunset View','Swimming Pool View','Unobstructed View','Waterfront View'
  ]::text[]);
