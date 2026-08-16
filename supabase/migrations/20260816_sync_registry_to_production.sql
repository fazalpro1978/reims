-- ─────────────────────────────────────────────────────────────────────────────
-- Shared Registry sync — run in the REIMS production Supabase project
-- (hbpxufqrdqaycwovirns) so it matches the Wikipedia-corrected data
-- already applied to the AXIOM project.
-- Safe to re-run (ON CONFLICT DO UPDATE, ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure new columns exist
ALTER TABLE public.cr_zone_codes
  ADD COLUMN IF NOT EXISTS area_km2   NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS population INTEGER;

-- 2. Upsert all 89 Qatar administrative zones — Wikipedia / 2015 census
INSERT INTO public.cr_zone_codes (zone_code, district_name, municipality, area_km2, population) VALUES

  -- ── Doha Municipality ────────────────────────────────────────────────────
  (1,  'Al Jasrah',                              'Doha Municipality',       0.4,    240),
  (2,  'Al Bidda',                               'Doha Municipality',       NULL,    35),
  (3,  'Fereej Mohamed Bin Jassim / Musheireb',  'Doha Municipality',       NULL,  4886),
  (4,  'Musheireb',                              'Doha Municipality',       0.3,   9791),
  (5,  'Al Najada / Barahat Al Jufairi',         'Doha Municipality',       0.2,   2086),
  (6,  'Old Al Ghanim',                          'Doha Municipality',       0.3,   1124),
  (7,  'Al Souq',                                'Doha Municipality',       0.3,    297),
  (10, 'Wadi Al Sail',                           'Doha Municipality',       NULL,     8),
  (11, 'Rumeilah',                               'Doha Municipality',       NULL,    63),
  (12, 'Al Bidda',                               'Doha Municipality',       NULL,  1067),
  (13, 'Musheireb',                              'Doha Municipality',       0.7,  18278),
  (14, 'Fereej Abdel Aziz',                      'Doha Municipality',       0.5,  15706),
  (15, 'Ad Dawhah al Jadidah',                   'Doha Municipality',       0.5,  15920),
  (16, 'Old Al Ghanim',                          'Doha Municipality',       0.4,  16334),
  (17, 'Al Rufaa / Old Al Hitmi',                'Doha Municipality',       0.4,   6026),
  (18, 'As Salatah / Al Mirqab',                 'Doha Municipality',       0.6,    692),
  (19, 'Doha Port',                              'Doha Municipality',       NULL,     6),
  (20, 'Wadi Al Sail',                           'Doha Municipality',       1.3,    240),
  (21, 'Rumeilah',                               'Doha Municipality',       0.8,   1590),
  (22, 'Fereej Bin Mahmoud',                     'Doha Municipality',       0.6,  11241),
  (23, 'Fereej Bin Mahmoud',                     'Doha Municipality',       1.8,  17086),
  (24, 'Rawdat Al Khail',                        'Doha Municipality',       1.7,  18200),
  (25, 'Fereej Bin Durham / Al Mansoura',        'Doha Municipality',       1.5,  37082),
  (26, 'Najma',                                  'Doha Municipality',       1.1,  28228),
  (27, 'Umm Ghuwailina',                         'Doha Municipality',       1.4,  33262),
  (28, 'Al Khulaifat / Ras Abu Aboud',           'Doha Municipality',       0.9,   1731),
  (30, 'Duhail',                                 'Doha Municipality',       6.8,   7705),
  (31, 'Umm Lekhba',                             'Doha Municipality',       3.1,  11897),
  (32, 'Madinat Khalifa North / Dahl Al Hamam',  'Doha Municipality',       2.4,  12364),
  (33, 'Al Markhiya',                            'Doha Municipality',       2.7,   6242),
  (34, 'Madinat Khalifa South',                  'Doha Municipality',       2.6,  38247),
  (35, 'Fereej Kulaib',                          'Doha Municipality',       1.1,   6507),
  (36, 'Al Messila',                             'Doha Municipality',       2.1,   6803),
  (37, 'Fereej Bin Omran / Hamad Medical City',  'Doha Municipality',       2.5,  26121),
  (38, 'Al Sadd',                                'Doha Municipality',       3.5,  17820),
  (39, 'Al Sadd / New Al Mirqab / Fereej Al Nasr','Doha Municipality',      2.7,  23853),
  (40, 'New Salatah',                            'Doha Municipality',       3.5,  16086),
  (41, 'Nuaija',                                 'Doha Municipality',       1.2,   4743),
  (42, 'Al Hilal',                               'Doha Municipality',       1.8,  11671),
  (43, 'Nuaija',                                 'Doha Municipality',       4.8,  14871),
  (44, 'Nuaija',                                 'Doha Municipality',       3.2,  13765),
  (45, 'Old Airport',                            'Doha Municipality',       4.7,  48525),
  (46, 'Al Thumama',                             'Doha Municipality',       3.7,   8552),
  (47, 'Al Thumama',                             'Doha Municipality',       3.3,  12815),
  (48, 'Doha International Airport',             'Doha Municipality',      11.6,   1853),
  (49, 'Ras Abu Fontas',                         'Doha Municipality',      12.9,    442),
  (50, 'Al Thumama',                             'Doha Municipality',       7.6,   1137),
  (57, 'Industrial Area',                        'Doha Municipality',      32.1, 364710),
  (58, 'Wholesale Market',                       'Doha Municipality',       0.8,   4692),
  (61, 'Al Dafna / Al Qassar',                   'Doha Municipality',       4.0,   4022),
  (63, 'Onaiza',                                 'Doha Municipality',       2.0,   7562),
  (64, 'Lejbailat',                              'Doha Municipality',       1.4,   4151),
  (65, 'Onaiza',                                 'Doha Municipality',       2.1,   7875),
  (66, 'Onaiza / Leqtaifiya / Al Qassar',        'Doha Municipality',      26.1,  22024),
  (67, 'Hazm Al Markhiya',                       'Doha Municipality',       4.2,   8967),
  (68, 'Jelaiah / Al Tarfa / Jeryan Nejaima',    'Doha Municipality',       9.7,   5521),

  -- ── Al Rayyan Municipality ───────────────────────────────────────────────
  (51, 'Al Gharrafa / Gharrafat Al Rayyan',       'Al Rayyan Municipality',  80.9,  56027),
  (52, 'Old Al Rayyan / Al Luqta',                'Al Rayyan Municipality',  13.4,  18433),
  (53, 'New Al Rayyan / Muaither',                'Al Rayyan Municipality', 110.9,  77875),
  (54, 'Muraikh / Fereej Al Amir',                'Al Rayyan Municipality',  18.1,  24593),
  (55, 'Al Waab / Al Aziziya / Abu Hamour',       'Al Rayyan Municipality',  82.4, 283675),
  (56, 'Ain Khaled / Mesaimeer / Bu Samra',       'Al Rayyan Municipality',  61.1, 128928),
  (81, 'Mebaireek',                               'Al Rayyan Municipality', 160.5,  12483),
  (83, 'Al Karaana',                              'Al Rayyan Municipality', 554.3,   2614),
  (96, 'Abu Samra',                               'Al Rayyan Municipality', 801.7,    984),
  (97, 'Sawda Natheel',                           'Al Rayyan Municipality', 566.7,    100),

  -- ── Al Daayen Municipality ───────────────────────────────────────────────
  (69, 'Lusail / Al Kharayej / Wadi Al Banat',   'Al Daayen Municipality',  51.1,   1338),
  (70, 'Al Ebb / Al Kheesa / Al Sakhama / Lusail','Al Daayen Municipality', 239.1,  53001),

  -- ── Umm Salal Municipality ───────────────────────────────────────────────
  (71, 'Umm Salal Mohammed / Umm Salal Ali',     'Umm Salal Municipality',  318.4,  90835),

  -- ── Al Khor Municipality ─────────────────────────────────────────────────
  (74, 'Simaisma / Al Khor City',                'Al Khor Municipality',    373.9,  96169),
  (75, 'Al Thakhira / Ras Laffan',               'Al Khor Municipality',    610.8, 100118),
  (76, 'Al Ghuwariyah',                          'Al Khor Municipality',    628.6,   5744),

  -- ── Al Shamal Municipality ───────────────────────────────────────────────
  (77, 'Ain Sinan / Fuwayrit',                   'Al Shamal Municipality',  266.0,   1727),
  (78, 'Abu Dhalouf / Zubarah',                  'Al Shamal Municipality',  427.2,   1660),
  (79, 'Madinat ash Shamal / Ar Ru''ays',         'Al Shamal Municipality',  166.6,   5407),

  -- ── Al Shahaniya Municipality ────────────────────────────────────────────
  (72, 'Al Utouriya',                            'Al Shahaniya Municipality', 662.2,  1232),
  (73, 'Al Jemailiya',                           'Al Shahaniya Municipality', 623.3,  1685),
  (80, 'Al Shahaniya City',                      'Al Shahaniya Municipality', 287.1, 138509),
  (82, 'Rawdat Rashed',                          'Al Shahaniya Municipality', 454.1,  26258),
  (84, 'Umm Bab',                                'Al Shahaniya Municipality', 494.1,   5305),
  (85, 'Al Nasraniya',                           'Al Shahaniya Municipality', 423.2,   1308),
  (86, 'Dukhan',                                 'Al Shahaniya Municipality', 365.0,  13274),

  -- ── Al Wakrah Municipality ───────────────────────────────────────────────
  (90, 'Al Wakrah',                              'Al Wakrah Municipality',   75.8,  87970),
  (91, 'Al Wukair / Al Mashaf',                  'Al Wakrah Municipality',  203.4, 165214),
  (92, 'Mesaieed',                               'Al Wakrah Municipality',  133.2,  37548),
  (93, 'Mesaieed Industrial Area',               'Al Wakrah Municipality',   60.7,    106),
  (94, 'Shagra',                                 'Al Wakrah Municipality',  497.2,   4714),
  (95, 'Al Kharrara',                            'Al Wakrah Municipality',  902.4,   3478),
  (98, 'Khor Al Adaid',                          'Al Wakrah Municipality',  705.0,      7)

ON CONFLICT (zone_code) DO UPDATE SET
  district_name = EXCLUDED.district_name,
  municipality  = EXCLUDED.municipality,
  area_km2      = EXCLUDED.area_km2,
  population    = EXCLUDED.population;

-- Retain Zone 60 (Al Dafna) which is not in Wikipedia; just normalise municipality.
UPDATE public.cr_zone_codes
SET municipality = 'Doha Municipality'
WHERE zone_code = 60 AND district_name = 'Al Dafna';

-- 3. Cascade all corrected district names to units.zone
UPDATE public.units u
SET zone = z.district_name
FROM public.cr_zone_codes z
WHERE u.zone_code = z.zone_code
  AND u.zone IS DISTINCT FROM z.district_name;
