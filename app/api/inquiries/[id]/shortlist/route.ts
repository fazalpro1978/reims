import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { authorizeInquiry } from '@/lib/inquiryAccessServer';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party']);
  if (!auth.ok) return auth.response;
  const denied = await authorizeInquiry(admin, auth.auth, params.id);
  if (denied) return denied;

  try {
    const { matchId, shortlisted } = await req.json() as {
      matchId: string;
      shortlisted: boolean;
    };

    const { data, error } = await admin
      .from('inquiry_matches')
      .update({
        is_shortlisted:  shortlisted,
        shortlisted_at:  shortlisted ? new Date().toISOString() : null,
        shortlisted_by:  shortlisted ? auth.auth.fullName : null,
      })
      .eq('id', matchId)
      .eq('inquiry_id', params.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
    return NextResponse.json({ match: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Shortlist failed' }, { status: 500 });
  }
}
