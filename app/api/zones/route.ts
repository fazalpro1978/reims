import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../lib/serverAuth';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('cr_zone_codes')
    .select('zone_code, district_name, municipality')
    .order('zone_code');
  if (error) return NextResponse.json({ error: 'Failed to load zones' }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const zoneCode = Number(body.zone_code);
  if (!Number.isInteger(zoneCode) || zoneCode <= 0) {
    return NextResponse.json({ error: 'zone_code must be a positive integer' }, { status: 400 });
  }
  const rawName = String(body.district_name ?? '').trim();
  const districtName = rawName.replace(/^zone\s*\d+\s*[-–—]\s*/i, '').trim();
  if (!districtName) return NextResponse.json({ error: 'district_name is required' }, { status: 400 });
  const municipality = String(body.municipality ?? '').trim() || null;

  const { data, error } = await admin
    .from('cr_zone_codes')
    .update({ district_name: districtName, municipality })
    .eq('zone_code', zoneCode)
    .select('zone_code, district_name, municipality')
    .single();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

  // Cascade to units.zone so the matching engine, PDF reports, and
  // Synergy Center cards all reflect the updated zone name immediately.
  await admin
    .from('units')
    .update({ zone: districtName })
    .eq('zone_code', zoneCode);

  return NextResponse.json({ zone: data });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const zoneCode = Number(body.zone_code);
  if (!Number.isInteger(zoneCode) || zoneCode <= 0) {
    return NextResponse.json({ error: 'zone_code is required' }, { status: 400 });
  }
  const { error } = await admin.from('cr_zone_codes').delete().eq('zone_code', zoneCode);
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const zoneCode = Number(body.zone_code);
  if (!Number.isInteger(zoneCode) || zoneCode <= 0) {
    return NextResponse.json(
      { error: 'zone_code must be a positive integer — zone numbers are user-assigned.' },
      { status: 400 },
    );
  }
  // Strip any "Zone N -" prefix the user may have typed into the name
  const rawName = String(body.district_name ?? '').trim();
  const districtName = rawName.replace(/^zone\s*\d+\s*[-–—]\s*/i, '').trim();
  if (!districtName) {
    return NextResponse.json({ error: 'district_name is required' }, { status: 400 });
  }
  const municipality = String(body.municipality ?? '').trim() || null;

  const row: Record<string, unknown> = { zone_code: zoneCode, district_name: districtName };
  if (municipality) row.municipality = municipality;

  const { data, error } = await admin
    .from('cr_zone_codes')
    .upsert(row, { onConflict: 'zone_code' })
    .select('zone_code, district_name, municipality')
    .single();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

  // Cascade zone name to all units carrying this zone_code so the
  // inventory, dashboards, and synergy cards stay consistent.
  await admin
    .from('units')
    .update({ zone: districtName })
    .eq('zone_code', zoneCode);

  return NextResponse.json({ zone: data });
}
