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

async function assertAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const sb = adminClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await sb.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!p?.is_active) return null;
  if ((ROLE_RANK[p.role] ?? -1) < ROLE_RANK.administrator) return null;
  return { uid: user.id, role: p.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await assertAdmin(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = adminClient();
  const { data, error } = await sb.from('units').select('rent, status');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  let leased    = 0;
  let available = 0;
  let reserved  = 0;
  let total     = 0;

  for (const r of rows) {
    const rent = Number(r.rent) || 0;
    total += rent;
    if (r.status === 'Leased')     leased    += rent;
    if (r.status === 'Available')  available += rent;
    if (r.status === 'Reserved')   reserved  += rent;
  }

  return NextResponse.json({ leased, available, reserved, total });
}
