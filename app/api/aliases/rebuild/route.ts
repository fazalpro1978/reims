import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/aliases/rebuild
// Re-syncs alias_registry from units.alias_code.
// Inserts any unit that has alias_code set but no alias_registry entry.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const { data: units, error: unitsErr } = await admin
    .from('units')
    .select('id, alias_code, zone_code')
    .not('alias_code', 'is', null);

  if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

  const { data: existing, error: existErr } = await admin
    .from('alias_registry')
    .select('unit_id');

  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });

  const existingIds = new Set((existing ?? []).map((r: { unit_id: string }) => r.unit_id));
  const missing = (units ?? []).filter(u => !existingIds.has(u.id));

  if (missing.length === 0) {
    return NextResponse.json({ rebuilt: 0, message: 'Registry is already in sync.' });
  }

  const { error: insertErr } = await admin
    .from('alias_registry')
    .insert(missing.map(u => ({
      alias_code: u.alias_code,
      unit_id:    u.id,
      zone_code:  u.zone_code,
      zone_index: 0,
    })));

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ rebuilt: missing.length });
}
