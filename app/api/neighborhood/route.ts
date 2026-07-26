import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = () => ({
  apikey:        SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer:        'return=representation',
});

async function sbGet(path: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS() });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function sbPost(path: string, body: unknown) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: HEADERS(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return { data: null, error: json };
  return { data: Array.isArray(json) ? json[0] : json, error: null };
}

async function sbPatch(path: string, body: unknown) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: HEADERS(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return { data: null, error: json };
  return { data: Array.isArray(json) ? json[0] : json, error: null };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff', 'agent']);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const unitUuid = searchParams.get('unitUuid') ?? '';
  const zoneCode = searchParams.get('zoneCode') ?? '0';

  if (unitUuid) {
    const row = await sbGet(`unit_neighborhood?unit_uuid=eq.${encodeURIComponent(unitUuid)}&select=*`);
    if (row) return NextResponse.json({ data: row, source: 'unit' });
  }

  const row = await sbGet(`unit_neighborhood?zone_code=eq.${zoneCode}&is_zone_level=eq.true&select=*`);
  return NextResponse.json({ data: row, source: row ? 'zone' : 'none' });
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
    const existing = await sbGet(`unit_neighborhood?zone_code=eq.${zoneCode}&is_zone_level=eq.true&select=id`);
    const result = existing
      ? await sbPatch(`unit_neighborhood?id=eq.${existing.id}`, payload)
      : await sbPost('unit_neighborhood', { ...payload, unit_uuid: null });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ data: result.data });
  }

  const existing = await sbGet(`unit_neighborhood?unit_uuid=eq.${encodeURIComponent(unitUuid)}&select=id`);
  const result = existing
    ? await sbPatch(`unit_neighborhood?id=eq.${existing.id}`, payload)
    : await sbPost('unit_neighborhood', { ...payload, unit_uuid: unitUuid });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.data });
}
