import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  Prefer: 'count=exact',
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const sp       = new URL(req.url).searchParams;
  const typeCode    = sp.get('typeCode');
  const entityCode  = sp.get('entityCode');
  const agentCode   = sp.get('agentCode');
  const zoneCode    = sp.get('zoneCode');
  const municipality = sp.get('municipality');
  const dateFrom    = sp.get('dateFrom');
  const dateTo      = sp.get('dateTo');
  const q           = sp.get('q');
  const page        = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const pageSize    = 25;
  const offset      = (page - 1) * pageSize;

  let url = `${SB_URL}/rest/v1/cr_registry_full?select=*`;
  if (typeCode)    url += `&type_code=eq.${typeCode}`;
  if (entityCode)  url += `&entity_code=eq.${entityCode}`;
  if (agentCode)   url += `&agent_code=eq.${agentCode}`;
  if (zoneCode)    url += `&zone_code=eq.${zoneCode}`;
  if (municipality) url += `&municipality=eq.${encodeURIComponent(municipality)}`;
  if (dateFrom)    url += `&created_at=gte.${dateFrom}`;
  if (dateTo)      url += `&created_at=lte.${dateTo}T23:59:59`;
  if (q) {
    const enc = encodeURIComponent(q);
    url += `&or=(smart_code.ilike.*${enc}*,company_name.ilike.*${enc}*,district_name.ilike.*${enc}*,building_name.ilike.*${enc}*,unit_ref.ilike.*${enc}*)`;
  }
  url += `&order=created_at.desc&limit=${pageSize}&offset=${offset}`;

  const res  = await fetch(url, { headers: H() });
  const cr   = res.headers.get('content-range') ?? '';
  const total = parseInt(cr.split('/')[1] ?? '0') || 0;
  const data  = await res.json();

  return NextResponse.json({ data: Array.isArray(data) ? data : [], total, page, pageSize });
}
