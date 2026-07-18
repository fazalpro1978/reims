import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { data, error } = await admin
    .from('cr_zone_codes')
    .select('zone_code, district_name, municipality')
    .order('zone_code');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
