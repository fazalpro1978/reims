import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;
  const { zoneCode, districtName, municipality } = await req.json();

  const code = Number(zoneCode);
  if (!Number.isInteger(code) || code <= 0) {
    return NextResponse.json(
      { error: 'zoneCode must be a positive integer — zone numbers are user-assigned, not auto-generated.' },
      { status: 400 },
    );
  }
  if (!districtName?.trim()) {
    return NextResponse.json({ error: 'districtName is required' }, { status: 400 });
  }
  if (!municipality?.trim()) {
    return NextResponse.json({ error: 'municipality is required' }, { status: 400 });
  }

  // Reject if zone_code already exists
  const checkRes = await fetch(
    `${SB_URL}/rest/v1/cr_zone_codes?zone_code=eq.${code}&select=zone_code&limit=1`,
    { headers: H() },
  );
  const existing = await checkRes.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json(
      { error: `Zone code ${code} is already registered. Choose a different number.` },
      { status: 409 },
    );
  }

  // Strip any "Zone N -" or "Zone N—" prefix the user may have typed into the name
  const cleanName = districtName.trim().replace(/^zone\s*\d+\s*[-–—]\s*/i, '').trim();

  const res = await fetch(`${SB_URL}/rest/v1/cr_zone_codes`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      zone_code:     code,
      district_name: cleanName,
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
