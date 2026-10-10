import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('clients')
    .select(`
      *,
      inquiries!client_id (
        id, ref_no, status, listing_type, property_type, config,
        budget_min, budget_max, preferred_zones, follow_up_date,
        move_in_date, notes, assigned_agent, staff_name, created_at,
        match_count
      )
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ client: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.full_name   !== undefined) updates.full_name   = String(body.full_name).trim();
    if (body.phone       !== undefined) updates.phone       = body.phone       || null;
    if (body.email       !== undefined) updates.email       = body.email       || null;
    if (body.nationality !== undefined) updates.nationality = body.nationality || null;
    if (body.notes       !== undefined) updates.notes       = body.notes       || null;
    if (Array.isArray(body.tags))       updates.tags        = body.tags;

    // Opt-in changes — record timestamp when toggling on
    if (body.whatsapp_opt_in !== undefined) {
      updates.whatsapp_opt_in    = body.whatsapp_opt_in;
      updates.whatsapp_opt_in_at = body.whatsapp_opt_in ? new Date().toISOString() : null;
    }
    if (body.email_opt_in !== undefined) {
      updates.email_opt_in    = body.email_opt_in;
      updates.email_opt_in_at = body.email_opt_in ? new Date().toISOString() : null;
    }

    const { data, error } = await admin
      .from('clients')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505')
        return NextResponse.json({ error: 'A client with this phone number already exists.' }, { status: 409 });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  // Unlink inquiries first, then delete
  await admin.from('inquiries').update({ client_id: null }).eq('client_id', params.id);
  const { error } = await admin.from('clients').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
