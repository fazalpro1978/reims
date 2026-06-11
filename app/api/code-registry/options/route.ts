import { NextResponse } from 'next/server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({ apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` });

async function getAll(path: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H() });
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : [];
}

export async function GET() {
  const [configs, entities, agents, zones] = await Promise.all([
    getAll('cr_property_type_configs?select=*&order=core_type,sub_type,configuration'),
    getAll('cr_entity_codes?select=*&order=company_name'),
    getAll('cr_agents?select=*&order=agent_code'),
    getAll('cr_zone_codes?select=*&order=zone_code'),
  ]);
  return NextResponse.json({ configs, entities, agents, zones });
}
