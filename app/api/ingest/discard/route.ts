import { NextRequest, NextResponse } from 'next/server';

const INGEST_URL = process.env.INGEST_SERVICE_URL ?? 'https://axiom.propertyscape.io';
const INGEST_KEY = process.env.INGEST_API_KEY ?? '';

// POST /api/ingest/discard
// Acknowledges specific record IDs to Axiom without inserting them into REIMS.
// Removes them from the vetted queue permanently.
export async function POST(req: NextRequest) {
  try {
    const { ids } = (await req.json()) as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids[] required' }, { status: 400 });
    }

    const ackRes = await fetch(`${INGEST_URL}/api/export/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': INGEST_KEY },
      body: JSON.stringify({ ids }),
      cache: 'no-store',
    });

    if (!ackRes.ok) {
      const body = await ackRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Axiom acknowledge failed (HTTP ${ackRes.status}): ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ discarded: ids.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Discard failed' },
      { status: 500 },
    );
  }
}
