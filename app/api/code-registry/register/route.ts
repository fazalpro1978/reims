import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;
  const { typeCode, entityCode, agentCode, zoneCode, buildingName, floorRef, unitRef, notes } =
    await req.json();

  if (!typeCode || !entityCode || !agentCode || !zoneCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const res = await fetch(`${SB_URL}/rest/v1/rpc/cr_generate_smart_code`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      p_type_code:     typeCode,
      p_entity_code:   entityCode,
      p_agent_code:    agentCode,
      p_zone_code:     zoneCode,
      p_building_name: buildingName || null,
      p_floor_ref:     floorRef     || null,
      p_unit_ref:      unitRef      || null,
      p_notes:         notes        || null,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json }, { status: 500 });

  const row = Array.isArray(json) ? json[0] : json;
  return NextResponse.json({ smartCode: row.smart_code, sequenceNumber: row.sequence_number, category: row.category });
}
