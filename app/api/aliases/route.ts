import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { getOrCreateAlias } from '@/lib/aliasEngine';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/aliases — list all aliases with unit info
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('q')?.trim() ?? '';
  const limit  = Math.min(Number(searchParams.get('limit') ?? 100), 500);
  const offset = Number(searchParams.get('offset') ?? 0);

  let query = admin
    .from('alias_registry')
    .select(`
      alias_code,
      unit_id,
      zone_code,
      zone_index,
      created_at,
      unit:units(unit_code, property, unit_no, zone),
      zone_tag:alias_zone_tags(zone_tag, zone_label)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `alias_code.ilike.%${search}%,unit_id.eq.${search}`
    );
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ aliases: data ?? [], total: count ?? 0 });
}

// POST /api/aliases — generate alias for a unit
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { unitId } = await req.json() as { unitId?: string };
  if (!unitId) return NextResponse.json({ error: 'unitId is required' }, { status: 400 });

  // Look up the unit's zone_code
  const { data: unit, error: unitErr } = await admin
    .from('units')
    .select('id, zone_code, alias_code')
    .eq('id', unitId)
    .single();

  if (unitErr || !unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  if (!unit.zone_code) {
    return NextResponse.json({ error: 'Unit has no zone_code — cannot generate alias' }, { status: 422 });
  }

  try {
    const aliasCode = await getOrCreateAlias(unit.id, unit.zone_code, auth.auth.email);
    return NextResponse.json({ aliasCode }, { status: unit.alias_code ? 200 : 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Alias generation failed' },
      { status: 500 },
    );
  }
}
