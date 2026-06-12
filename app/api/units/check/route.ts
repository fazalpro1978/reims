import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { unit_codes } = (await req.json()) as { unit_codes: string[] };

    if (!Array.isArray(unit_codes) || unit_codes.length === 0) {
      return NextResponse.json({ existing: {} });
    }

    const { data } = await admin
      .from('units')
      .select('id, unit_code, property, status, rent')
      .in('unit_code', unit_codes);

    const existing: Record<string, { id: string; property: string; status: string; rent: number }> = {};
    for (const row of data ?? []) {
      existing[row.unit_code] = {
        id: row.id,
        property: row.property,
        status: row.status,
        rent: row.rent,
      };
    }

    return NextResponse.json({ existing });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Check failed' },
      { status: 500 },
    );
  }
}
