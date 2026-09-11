import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey:        SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  Prefer:        'count=exact',
});

const COLS = [
  'id', 'realtor_name', 'master_code', 'smart_code',
  'property', 'unit_no', 'zone_code', 'zone',
  'type', 'config', 'bathrooms', 'parking',
  'kitchen', 'furnishing', 'rent', 'status', 'created_at',
].join(',');

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const sp         = new URL(req.url).searchParams;
  const q          = sp.get('q');
  const unitType   = sp.get('type');
  const config     = sp.get('config');
  const company    = sp.get('company');
  const agentCode  = sp.get('agentCode');
  const zoneCodes  = sp.get('zoneCodes');   // comma-sep from municipality expansion
  const zoneCode   = sp.get('zoneCode');
  const dateFrom   = sp.get('dateFrom');
  const dateTo     = sp.get('dateTo');
  const page       = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const pageSize   = 25;
  const offset     = (page - 1) * pageSize;

  let url = `${SB_URL}/rest/v1/units?select=${COLS}`;

  if (unitType)   url += `&type=eq.${encodeURIComponent(unitType)}`;
  if (config)     url += `&config=ilike.*${encodeURIComponent(config)}*`;
  if (company)    url += `&realtor_name=ilike.*${encodeURIComponent(company)}*`;
  if (zoneCode)   url += `&zone_code=eq.${zoneCode}`;
  if (zoneCodes)  url += `&zone_code=in.(${zoneCodes})`;
  if (dateFrom)   url += `&created_at=gte.${dateFrom}`;
  if (dateTo)     url += `&created_at=lte.${dateTo}T23:59:59`;

  // Agent: positions 5–6 in smart_code encode the agent_code (after Category[1]+Entity[3])
  if (agentCode) {
    url += `&smart_code=ilike.????${encodeURIComponent(agentCode)}*`;
  }

  if (q) {
    const enc = encodeURIComponent(q);
    url += `&or=(smart_code.ilike.*${enc}*,master_code.ilike.*${enc}*,property.ilike.*${enc}*,unit_no.ilike.*${enc}*,realtor_name.ilike.*${enc}*,zone.ilike.*${enc}*)`;
  }

  url += `&order=created_at.desc&limit=${pageSize}&offset=${offset}`;

  const res   = await fetch(url, { headers: H() });
  const cr    = res.headers.get('content-range') ?? '';
  const total = parseInt(cr.split('/')[1] ?? '0') || 0;
  const data  = await res.json();

  return NextResponse.json({ data: Array.isArray(data) ? data : [], total, page, pageSize });
}
