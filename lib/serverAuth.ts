import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Role = 'superuser' | 'administrator' | 'staff' | 'agent' | 'public';

export interface AuthResult {
  uid:      string;
  role:     Role;
  email:    string;
  fullName: string;
}

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

export async function requireAuth(
  req: NextRequest,
  allowedRoles?: Role[],
): Promise<{ ok: true; auth: AuthResult } | { ok: false; response: NextResponse }> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const supabase = serviceClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

  if (userErr || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('id', user.id)
    .single();

  if (!profile?.is_active) {
    return { ok: false, response: NextResponse.json({ error: 'Account inactive' }, { status: 403 }) };
  }

  const role = profile.role as Role;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return {
    ok: true,
    auth: {
      uid:      user.id,
      role,
      email:    user.email ?? '',
      fullName: profile.full_name ?? user.email?.split('@')[0] ?? '',
    },
  };
}
