import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const INGEST_URL = process.env.INGEST_SERVICE_URL ?? 'https://d-inges.vercel.app';
const INGEST_KEY = process.env.INGEST_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;
  if (!INGEST_KEY) {
    return NextResponse.json({ error: 'INGEST_API_KEY is not configured on this server.' }, { status: 503 });
  }
  try {
    const res = await fetch(`${INGEST_URL}/api/export/vetted`, {
      headers: { 'x-api-key': INGEST_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error ?? 'dInges returned an error' }, { status: res.status });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to reach dInges service' }, { status: 502 });
  }
}
