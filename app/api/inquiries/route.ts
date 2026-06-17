import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const agent  = searchParams.get('agent');

  let query = admin
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (agent)                      query = query.eq('assigned_agent', agent);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await admin
      .from('inquiries')
      .insert(body)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create new_inquiry notification
    await admin.from('notifications').insert({
      type:           'new_inquiry',
      title:          `New inquiry from ${data.client_name}`,
      body:           `${data.listing_type ?? ''} · ${data.property_type ?? ''} · Budget QAR ${(data.budget_min ?? 0).toLocaleString()}–${(data.budget_max ?? 0).toLocaleString()}`,
      inquiry_id:     data.id,
      assigned_agent: data.assigned_agent ?? null,
    });

    return NextResponse.json({ inquiry: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Create failed' }, { status: 500 });
  }
}
