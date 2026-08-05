import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNIT_JOIN = '*, assigned_unit:units!assigned_unit_id(id, unit_code, unit_no, property, alias_code), assigned_unit2:units!assigned_unit_id_2(id, unit_code, unit_no, property, alias_code), assigned_unit3:units!assigned_unit_id_3(id, unit_code, unit_no, property, alias_code)';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const agent  = searchParams.get('agent');

  // For staff: resolve their agent code from cr_agents so the filter can match
  // inquiries where they are the consultant (assigned_agent) OR the handler (staff_email).
  let staffOrFilter: string | null = null;
  if (auth.auth.role === 'staff') {
    const { data: agentRow } = await admin
      .from('cr_agents')
      .select('agent_code')
      .eq('email', auth.auth.email)
      .maybeSingle();
    const code = agentRow?.agent_code;
    staffOrFilter = code
      ? `staff_email.eq.${auth.auth.email},assigned_agent.eq.${code}`
      : `staff_email.eq.${auth.auth.email}`;
  }

  // Aggregate stats — scoped to the caller's own records for staff
  let statsQuery = admin.from('inquiries').select('id, status, match_count');
  if (staffOrFilter) statsQuery = statsQuery.or(staffOrFilter);
  const { data: allRows } = await statsQuery;
  const allStats = {
    total:   allRows?.length ?? 0,
    new:     (allRows ?? []).filter((i: { status: string }) => i.status === 'new').length,
    open:    (allRows ?? []).filter((i: { status: string }) => !['won','lost','cancelled','closed'].includes(i.status)).length,
    won:     (allRows ?? []).filter((i: { status: string }) => i.status === 'won').length,
    matches: (allRows ?? []).reduce((s: number, i: { match_count: number }) => s + (i.match_count ?? 0), 0),
  };

  let query = admin
    .from('inquiries')
    .select(UNIT_JOIN)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (agent)                      query = query.eq('assigned_agent', agent);
  if (staffOrFilter)              query = query.or(staffOrFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ inquiries: data ?? [], allStats });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    if (!body.client_name?.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    const row: Record<string, unknown> = {
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

    // Staff inquiries are auto-assigned to the creating user
    if (auth.auth.role === 'staff') {
      row.staff_email       = auth.auth.email;
      row.staff_name        = auth.auth.fullName;
      row.staff_assigned_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from('inquiries')
      .insert(row)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

    void Promise.resolve(
      admin.from('notifications').insert({
        type:       'new_inquiry',
        title:      `New inquiry from ${data.client_name}`,
        body:       `${data.listing_type ?? ''} · ${data.property_type ?? ''} · Budget QAR ${(data.budget_min ?? 0).toLocaleString()}–${(data.budget_max ?? 0).toLocaleString()}`,
        inquiry_id: data.id,
      })
    ).catch(() => {});

    return NextResponse.json({ inquiry: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}
