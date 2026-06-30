import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const INGEST_URL = process.env.INGEST_SERVICE_URL ?? 'https://d-inges.vercel.app';
const INGEST_KEY = process.env.INGEST_API_KEY ?? '';

type VettedRecord = { id: string; payload: Record<string, unknown> };

export async function POST(req: NextRequest) {
  try {
    const { records } = (await req.json()) as { records: VettedRecord[] };
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records[] required' }, { status: 400 });
    }

    // ── 1. Upsert into public.units ─────────────────────────────────────────
    const rows = records.map((r) => r.payload);
    const unitCodes = rows
      .map((r) => r.unit_code)
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '');

    const { data: existing } = await admin
      .from('units')
      .select('id, unit_code')
      .in('unit_code', unitCodes);

    const existingMap = new Map(
      (existing ?? []).map((r: { id: string; unit_code: string }) => [r.unit_code, r.id]),
    );

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

    for (const row of rows) {
      const code = row.unit_code as string;
      const existingId = existingMap.get(code);
      if (existingId) {
        toUpdate.push({ id: existingId, data: { ...row, updated_at: new Date().toISOString() } });
      } else {
        toInsert.push(row);
      }
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    if (toInsert.length > 0) {
      const { error } = await admin.from('units').insert(toInsert);
      if (error) errors.push(`Bulk insert: ${error.message}`);
      else inserted = toInsert.length;
    }

    for (const { id, data } of toUpdate) {
      const { error } = await admin.from('units').update(data).eq('id', id);
      if (error) errors.push(`Update ${data.unit_code}: ${error.message}`);
      else updated++;
    }

    // ── 2. Acknowledge back to dInges ───────────────────────────────────────
    let acknowledged = 0;
    if (INGEST_KEY) {
      const ids = records.map((r) => r.id);
      try {
        const ackRes = await fetch(`${INGEST_URL}/api/export/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': INGEST_KEY },
          body: JSON.stringify({ ids }),
        });
        if (ackRes.ok) acknowledged = ids.length;
      } catch {
        errors.push('Acknowledgement to dInges failed — records were imported but remain in the vetted queue.');
      }
    }

    return NextResponse.json({ inserted, updated, acknowledged, errors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Apply failed' }, { status: 500 });
  }
}
