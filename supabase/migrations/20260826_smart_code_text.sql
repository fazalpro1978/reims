-- smart_code format changed from fixed 14-digit serial to prefix-unit_no (e.g. RAARAA66-1214)
-- Variable length: prefix(8) + hyphen(1) + unit_no(unbounded) — VARCHAR(14) is too short.
ALTER TABLE public.units ALTER COLUMN smart_code TYPE TEXT;
