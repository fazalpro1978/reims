import { NextRequest, NextResponse } from 'next/server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

export async function POST(req: NextRequest) {
  const { districtName, municipality } = await req.json();

  if (!districtName?.trim() || !municipality?.trim()) {
    return NextResponse.json(
      { error: 'districtName and municipality are required' },
      { status: 400 },
    );
  }

  // Get the next available zone_code (max + 1)
  const countRes = await fetch(
    `${SB_URL}/rest/v1/cr_zone_codes?select=zone_code&order=zone_code.desc&limit=1`,
    { headers: H() },
  );
  const rows = await countRes.json();
  const nextCode = Array.isArray(rows) && rows.length > 0 ? rows[0].zone_code + 1 : 1;

  const res = await fetch(`${SB_URL}/rest/v1/cr_zone_codes`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      zone_code:     nextCode,
      district_name: districtName.trim(),
      municipality:  municipality.trim(),
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json }, { status: 500 });

  const row = Array.isArray(json) ? json[0] : json;
  return NextResponse.json({
    zoneCode:     row.zone_code,
    districtName: row.district_name,
    municipality: row.municipality,
  });
}
