import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  try {
    const { unitUuid } = await req.json() as { unitUuid: string };

    if (!unitUuid || typeof unitUuid !== 'string') {
      return NextResponse.json({ error: 'unitUuid is required' }, { status: 400 });
    }

    const { data: row, error: fetchErr } = await admin
      .from('units')
      .select('*')
      .eq('id', unitUuid)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json(
        { error: fetchErr?.message ?? 'Unit not found' },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = row;
    const newCode = `${row.unit_code}-COPY`;
    const newRow = {
      ...rest,
      unit_code:            newCode,
      status:               'Available',
      moci_contract_status: 'DRAFT',
      moci_contract_number: null,
      contract_start_date:  null,
      contract_end_date:    null,
    };

    const { error: insertErr } = await admin.from('units').insert(newRow);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, newCode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Duplicate failed' },
      { status: 500 }
    );
  }
}
