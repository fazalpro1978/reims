import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function assertRole(req: NextRequest, minRole: 'administrator' | 'superuser') {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const sb = adminClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await sb.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!p?.is_active) return null;
  const allowed = minRole === 'superuser'
    ? ['superuser']
    : ['superuser', 'administrator'];
  if (!allowed.includes(p.role)) return null;
  return { uid: user.id, role: p.role as string };
}

// GET — any admin+ can read the matrix
export async function GET(req: NextRequest) {
  const caller = await assertRole(req, 'administrator');
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const sb = adminClient();
    const { data, error } = await sb
      .from('role_permissions')
      .select('permission_key,role,level');

    if (error) return NextResponse.json({ rows: [] });

    return NextResponse.json({ rows: data ?? [] });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}

// POST — superuser only: upsert full matrix
export async function POST(req: NextRequest) {
  const caller = await assertRole(req, 'superuser');
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await req.json() as {
    rows: { permission_key: string; role: string; level: string }[]
  };

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  try {
    const sb = adminClient();
    const payload = rows.map(r => ({
      permission_key: r.permission_key,
      role:           r.role,
      level:          r.level,
      updated_by:     caller.uid,
    }));

    const { error } = await sb
      .from('role_permissions')
      .upsert(payload, { onConflict: 'permission_key,role' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
