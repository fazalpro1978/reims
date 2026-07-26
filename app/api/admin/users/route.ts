import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS, server-only
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// Auth guard — only superuser / administrator
async function assertAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .single();

  if (!profile?.is_active || !['superuser','administrator'].includes(profile.role)) return null;
  return { uid: user.id, role: profile.role };
}

// GET /api/admin/users — list all profiles
export async function GET(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,department,platforms,is_active,created_at')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

// PUT /api/admin/users — update role / is_active
// Body: { id: string, role?: string, is_active?: boolean, platforms?: string[] }
export async function PUT(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { id?: string; role?: string; is_active?: boolean; platforms?: string[] };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Administrators cannot promote to superuser
  if (admin.role === 'administrator' && body.role === 'superuser') {
    return NextResponse.json({ error: 'Administrators cannot assign the Superuser role' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body.role       !== undefined) patch.role       = body.role;
  if (body.is_active  !== undefined) patch.is_active  = body.is_active;
  if (body.platforms  !== undefined) patch.platforms  = body.platforms;

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
