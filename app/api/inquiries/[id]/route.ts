import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNIT_JOIN = '*, assigned_unit:units!assigned_unit_id(id, unit_code, unit_no, property)';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin
    .from('inquiries')
    .select(UNIT_JOIN)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    // Allowlist only patchable fields — never forward arbitrary body keys.
    const allowed: Record<string, unknown> = {};
    const patchable = [
      'status', 'assigned_agent', 'assigned_unit_id',
      'follow_up_date', 'notes',
    ];
    for (const key of patchable) {
      if (key in body) allowed[key] = body[key] ?? null;
    }

    const { data, error } = await admin
      .from('inquiries')
      .update(allowed)
      .eq('id', params.id)
      .select(UNIT_JOIN)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inquiry: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await admin.from('inquiries').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
