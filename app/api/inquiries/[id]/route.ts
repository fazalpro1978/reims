import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin
    .from('inquiries')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { data, error } = await admin
      .from('inquiries')
      .update(body)
      .eq('id', params.id)
      .select('*')
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
