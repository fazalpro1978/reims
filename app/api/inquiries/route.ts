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
    .select('*, assigned_unit:units!assigned_unit_id(id, unit_code, unit_no, property), assigned_unit2:units!assigned_unit_id_2(id, unit_code, unit_no, property), assigned_unit3:units!assigned_unit_id_3(id, unit_code, unit_no, property)')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (agent)                      query = query.eq('assigned_agent', agent);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ inquiries: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.client_name?.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    // Explicit field mapping — never blindly forward raw body to Supabase.
    // assigned_agent is intentionally excluded: agent routing is a post-match event.
    const row = {
      client_name:        String(body.client_name).trim(),
      client_phone:       body.client_phone       || null,
      client_email:       body.client_email       || null,
      client_nationality: body.client_nationality || null,
      source:             body.source             || null,
      listing_type:       body.listing_type       || null,
      property_type:      body.property_type      || null,
      config:             body.config             || null,
      bathrooms_min:      body.bathrooms_min != null ? Number(body.bathrooms_min) : null,
      budget_min:         body.budget_min     != null ? Number(body.budget_min)   : null,
      budget_max:         body.budget_max     != null ? Number(body.budget_max)   : null,
      preferred_zones:    Array.isArray(body.preferred_zones) ? body.preferred_zones : [],
      furnishing:         body.furnishing         || null,
      follow_up_date:     body.follow_up_date     || null,
      move_in_date:       body.move_in_date       || null,
      bills_included:     body.bills_included     || null,
      size:               body.size != null ? Number(body.size) : null,
      notes:              body.notes              || null,
    };

    const { data, error } = await admin
      .from('inquiries')
      .insert(row)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

    // Fire notification asynchronously — never block the inquiry response on this.
    void Promise.resolve(
      admin.from('notifications').insert({
        type:       'new_inquiry',
        title:      `New inquiry from ${data.client_name}`,
        body:       `${data.listing_type ?? ''} · ${data.property_type ?? ''} · Budget QAR ${(data.budget_min ?? 0).toLocaleString()}–${(data.budget_max ?? 0).toLocaleString()}`,
        inquiry_id: data.id,
      })
    ).catch(() => {});

    return NextResponse.json({ inquiry: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 500 },
    );
  }
}
