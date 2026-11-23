import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { authorizeInquiry } from '@/lib/inquiryAccessServer';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/inquiries/[id]/events — creation + match-run audit events, oldest first.
// Visible to anyone who may open the inquiry (admin, superuser, owner, handler, consultant).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party']);
  if (!auth.ok) return auth.response;
  const denied = await authorizeInquiry(admin, auth.auth, params.id);
  if (denied) return denied;

  const { data, error } = await admin
    .from('cr_inquiry_events')
    .select('id, event_type, actor_name, actor_email, actor_code, details, created_at')
    .eq('inquiry_id', params.id)
    .order('created_at', { ascending: true });

  // Table not created yet → empty ledger rather than an error
  if (error) return NextResponse.json({ events: [] });
  return NextResponse.json({ events: data ?? [] });
}
