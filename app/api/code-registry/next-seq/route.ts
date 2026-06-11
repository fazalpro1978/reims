import { NextResponse } from 'next/server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  const res = await fetch(
    `${SB_URL}/rest/v1/cr_sequence_counters?select=next_seq&order=next_seq.asc&limit=1`,
    {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      },
      cache: 'no-store',
    },
  );

  if (!res.ok) return NextResponse.json({ nextSeq: 299 });

  const rows = await res.json();
  const nextSeq = Array.isArray(rows) && rows.length > 0 ? rows[0].next_seq : 299;
  return NextResponse.json({ nextSeq });
}
