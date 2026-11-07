-- Seed map_url for all zones in cr_zone_codes.
-- Uses Google Maps Place URLs — stable, zone-level location links.
-- Zone 69 (Lusail) was already seeded in 20261107_zone_map_url.sql;
-- this migration covers all remaining zones.
-- Safe to re-run (WHERE map_url IS NULL guard on each block).

-- ── Doha Municipality ──────────────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Jasrah,+Qatar'                     WHERE zone_code = 1  AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Bidda,+Doha,+Qatar'               WHERE zone_code IN (2, 12) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Musheireb,+Doha,+Qatar'              WHERE zone_code IN (3, 4, 13) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Najada,+Doha,+Qatar'              WHERE zone_code = 5  AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Old+Al+Ghanim,+Doha,+Qatar'         WHERE zone_code IN (6, 16) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Souq+Waqif,+Doha,+Qatar'            WHERE zone_code = 7  AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Wadi+Al+Sail,+Doha,+Qatar'          WHERE zone_code IN (10, 20) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Rumeilah,+Doha,+Qatar'              WHERE zone_code IN (11, 21) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Fereej+Abdel+Aziz,+Doha,+Qatar'    WHERE zone_code = 14 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Ad+Dawhah+al+Jadidah,+Doha,+Qatar' WHERE zone_code = 15 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Rufaa,+Doha,+Qatar'              WHERE zone_code = 17 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Mirqab,+Doha,+Qatar'             WHERE zone_code = 18 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Doha+Port,+Qatar'                   WHERE zone_code = 19 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Fereej+Bin+Mahmoud,+Doha,+Qatar'   WHERE zone_code IN (22, 23) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Rawdat+Al+Khail,+Doha,+Qatar'      WHERE zone_code = 24 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Mansoura,+Doha,+Qatar'          WHERE zone_code = 25 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Najma,+Doha,+Qatar'                WHERE zone_code = 26 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Umm+Ghuwailina,+Doha,+Qatar'       WHERE zone_code = 27 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Ras+Abu+Aboud,+Doha,+Qatar'        WHERE zone_code = 28 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Duhail,+Doha,+Qatar'               WHERE zone_code = 30 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Umm+Lekhba,+Doha,+Qatar'           WHERE zone_code = 31 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Madinat+Khalifa+North,+Doha,+Qatar' WHERE zone_code = 32 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Markhiya,+Doha,+Qatar'          WHERE zone_code = 33 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Madinat+Khalifa+South,+Doha,+Qatar' WHERE zone_code = 34 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Fereej+Kulaib,+Doha,+Qatar'        WHERE zone_code = 35 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Messila,+Doha,+Qatar'           WHERE zone_code = 36 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Fereej+Bin+Omran,+Doha,+Qatar'    WHERE zone_code = 37 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Sadd,+Doha,+Qatar'              WHERE zone_code IN (38, 39) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/New+Salata,+Doha,+Qatar'           WHERE zone_code = 40 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Nuaija,+Doha,+Qatar'               WHERE zone_code IN (41, 43, 44) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Hilal,+Doha,+Qatar'             WHERE zone_code = 42 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Old+Airport+Road,+Doha,+Qatar'     WHERE zone_code = 45 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Thumama,+Doha,+Qatar'           WHERE zone_code IN (46, 47, 50) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Hamad+International+Airport,+Qatar' WHERE zone_code = 48 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Ras+Abu+Fontas,+Doha,+Qatar'       WHERE zone_code = 49 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Industrial+Area,+Doha,+Qatar'      WHERE zone_code = 57 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Wholesale+Market,+Doha,+Qatar'     WHERE zone_code = 58 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Dafna,+Doha,+Qatar'             WHERE zone_code IN (60, 61) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Onaiza,+Doha,+Qatar'               WHERE zone_code IN (63, 65) AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Lejbailat,+Doha,+Qatar'            WHERE zone_code = 64 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Qassar,+Doha,+Qatar'            WHERE zone_code = 66 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Hazm+Al+Markhiya,+Doha,+Qatar'    WHERE zone_code = 67 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Jelaiah,+Doha,+Qatar'              WHERE zone_code = 68 AND map_url IS NULL;

-- ── Al Rayyan Municipality ─────────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Gharrafa,+Qatar'                WHERE zone_code = 51 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Rayyan,+Qatar'                  WHERE zone_code = 52 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Muaither,+Qatar'                   WHERE zone_code = 53 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Muraikh,+Qatar'                    WHERE zone_code = 54 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Waab,+Qatar'                    WHERE zone_code = 55 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Ain+Khaled,+Qatar'                 WHERE zone_code = 56 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Mebaireek,+Qatar'                  WHERE zone_code = 81 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Karaana,+Qatar'                 WHERE zone_code = 83 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Abu+Samra,+Qatar'                  WHERE zone_code = 96 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Sawda+Natheel,+Qatar'              WHERE zone_code = 97 AND map_url IS NULL;

-- ── Al Daayen Municipality ─────────────────────────────────────────────────

-- Zone 69 already seeded in 20261107_zone_map_url.sql — skip.
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Kheesa,+Qatar'                  WHERE zone_code = 70 AND map_url IS NULL;

-- ── Umm Salal Municipality ─────────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Umm+Salal+Mohammed,+Qatar'         WHERE zone_code = 71 AND map_url IS NULL;

-- ── Al Khor Municipality ───────────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Khor,+Qatar'                    WHERE zone_code = 74 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Ras+Laffan,+Qatar'                 WHERE zone_code = 75 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Ghuwariyah,+Qatar'              WHERE zone_code = 76 AND map_url IS NULL;

-- ── Al Shamal Municipality ─────────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Fuwayrit,+Qatar'                   WHERE zone_code = 77 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Zubarah,+Qatar'                 WHERE zone_code = 78 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Ar+Ruays,+Qatar'                   WHERE zone_code = 79 AND map_url IS NULL;

-- ── Al Shahaniya Municipality ──────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Utouriya,+Qatar'                WHERE zone_code = 72 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Jemailiya,+Qatar'               WHERE zone_code = 73 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Shahaniya,+Qatar'               WHERE zone_code = 80 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Rawdat+Rashed,+Qatar'              WHERE zone_code = 82 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Umm+Bab,+Qatar'                    WHERE zone_code = 84 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Nasraniya,+Qatar'               WHERE zone_code = 85 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Dukhan,+Qatar'                     WHERE zone_code = 86 AND map_url IS NULL;

-- ── Al Wakrah Municipality ─────────────────────────────────────────────────

UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Wakrah,+Qatar'                  WHERE zone_code = 90 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Wukair,+Qatar'                  WHERE zone_code = 91 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Mesaieed,+Qatar'                   WHERE zone_code = 92 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Mesaieed+Industrial+Area,+Qatar'   WHERE zone_code = 93 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Shagra,+Qatar'                     WHERE zone_code = 94 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Al+Kharrara,+Qatar'                WHERE zone_code = 95 AND map_url IS NULL;
UPDATE public.cr_zone_codes SET map_url = 'https://www.google.com/maps/place/Khor+Al+Adaid,+Qatar'              WHERE zone_code = 98 AND map_url IS NULL;

-- ── Backfill existing units that have a zone_code but no location_map_url ──

UPDATE public.units u
SET location_map_url = z.map_url
FROM public.cr_zone_codes z
WHERE u.zone_code = z.zone_code
  AND z.map_url IS NOT NULL
  AND (u.location_map_url IS NULL OR u.location_map_url = '');
