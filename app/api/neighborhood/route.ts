import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unitUuid = searchParams.get('unitUuid') ?? '';
  const zoneCode = Number(searchParams.get('zoneCode') ?? 0);

  if (unitUuid) {
    const { data } = await admin
      .from('unit_neighborhood')
      .select('*')
      .eq('unit_uuid', unitUuid)
      .maybeSingle();
    if (data) return NextResponse.json({ data, source: 'unit' });
  }

  const { data } = await admin
    .from('unit_neighborhood')
    .select('*')
    .eq('zone_code', zoneCode)
    .eq('is_zone_level', true)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null, source: data ? 'zone' : 'none' });
}

export async function POST(req: NextRequest) {
  const { unitUuid, zoneCode, isZoneLevel, lifestyle, parks, commute } = await req.json();

  const payload = {
    zone_code:      zoneCode,
    is_zone_level:  !!isZoneLevel,
    lifestyle_data: lifestyle ?? [],
    parks_data:     parks     ?? [],
    commute_data:   commute   ?? [],
    last_updated:   new Date().toISOString(),
  };

  if (isZoneLevel) {
    const { data: existing } = await admin
      .from('unit_neighborhood')
      .select('id')
      .eq('zone_code', zoneCode)
      .eq('is_zone_level', true)
      .maybeSingle();

    const q = existing
      ? admin.from('unit_neighborhood').update(payload).eq('id', existing.id)
      : admin.from('unit_neighborhood').insert({ ...payload, unit_uuid: null });

    const { data, error } = await q.select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const { data: existing } = await admin
    .from('unit_neighborhood')
    .select('id')
    .eq('unit_uuid', unitUuid)
    .maybeSingle();

  const q = existing
    ? admin.from('unit_neighborhood').update(payload).eq('id', existing.id)
    : admin.from('unit_neighborhood').insert({ ...payload, unit_uuid: unitUuid });

  const { data, error } = await q.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
