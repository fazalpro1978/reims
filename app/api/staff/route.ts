import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/staff
 * Returns the mentionable staff roster (id + full_name + email) for all
 * authenticated users — used by @mention autocomplete in CommentThread.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party',
  ]);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['superuser', 'administrator', 'staff'])
    .eq('is_active', true)
    .order('full_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}
