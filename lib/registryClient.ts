import { createClient } from '@supabase/supabase-js';

// Centralised registry client used for Zone/District and Realtor operations.
// In production, set REGISTRY_SUPABASE_URL + REGISTRY_SERVICE_ROLE_KEY to the
// same shared Supabase project configured in AXIOM so both applications write
// to a single live copy of cr_zone_codes and realtors — any change made by a
// superuser or administrator in either system propagates instantly system-wide.
// Falls back to the application's own DB when these vars are absent.
export const registry = createClient(
  process.env.REGISTRY_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.REGISTRY_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
