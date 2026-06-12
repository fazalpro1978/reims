import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: Record<string, unknown>[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

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

    return NextResponse.json({ inserted, updated, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
