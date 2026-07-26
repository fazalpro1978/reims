import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const prefix = req.nextUrl.searchParams.get('prefix');

  if (!prefix) return NextResponse.json({ nextSeq: 1 });

  const res = await fetch(
    `${SB_URL}/rest/v1/cr_sequence_counters?prefix=eq.${encodeURIComponent(prefix)}&select=next_seq`,
    {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: 'no-store',
    },
  );

  if (!res.ok) return NextResponse.json({ nextSeq: 1 });

  const rows = await res.json();
  const nextSeq = Array.isArray(rows) && rows.length > 0 ? rows[0].next_seq : 1;
  return NextResponse.json({ nextSeq });
}
