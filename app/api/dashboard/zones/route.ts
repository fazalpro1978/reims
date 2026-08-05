import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ROLE_RANK: Record<string, number> = {
  superuser: 4, administrator: 3, staff: 2, agent: 1, public: 0,
};

async function assertStaff(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const sb = adminClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await sb.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!p?.is_active) return null;
  if ((ROLE_RANK[p.role] ?? -1) < ROLE_RANK.agent) return null;
  return { uid: user.id, role: p.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await assertStaff(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = adminClient();
  const { data, error } = await sb.from('units').select('zone, status');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<string, { total: number; available: number }> = {};
  for (const r of data ?? []) {
    const z = r.zone ?? 'Unassigned';
    if (!map[z]) map[z] = { total: 0, available: 0 };
    map[z].total++;
    if (r.status === 'Available') map[z].available++;
  }

  const zones = Object.entries(map)
    .map(([zone, v]) => ({ zone, ...v }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ zones });
}
