import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/synergy/unit-logs?unit_code=X&lead_id=Y
 * Returns all activity log entries for a specific unit + lead combination.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party',
  ]);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const unit_code = searchParams.get('unit_code');
  const lead_id   = searchParams.get('lead_id');

  if (!unit_code || !lead_id) {
    return NextResponse.json({ error: 'unit_code and lead_id are required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('cr_synergy_unit_activity_logs')
    .select('id, author_name, pipeline_stage, note, created_at')
    .eq('unit_code', unit_code)
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

/**
 * POST /api/synergy/unit-logs
 * Body: { unit_code, lead_id, pipeline_stage, note }
 * Inserts a new activity log entry authored by the calling user.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker',
  ]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({})) as {
    unit_code?: string;
    lead_id?: string;
    pipeline_stage?: string;
    note?: string;
  };

  const { unit_code, lead_id, pipeline_stage, note } = body;

  if (!unit_code || !lead_id || !pipeline_stage || !note?.trim()) {
    return NextResponse.json(
      { error: 'unit_code, lead_id, pipeline_stage and note are required' },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from('cr_synergy_unit_activity_logs')
    .insert({
      unit_code,
      lead_id,
      author_id:      auth.auth.uid,
      author_name:    auth.auth.fullName || auth.auth.email,
      pipeline_stage,
      note:           note.trim(),
    })
    .select('id, author_name, pipeline_stage, note, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data }, { status: 201 });
}

/**
 * DELETE /api/synergy/unit-logs?id=UUID
 * Removes a single log entry — only the original author or superuser/administrator may delete.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker',
  ]);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Fetch the entry to verify ownership
  const { data: entry, error: fetchErr } = await admin
    .from('cr_synergy_unit_activity_logs')
    .select('author_id')
    .eq('id', id)
    .single();

  if (fetchErr || !entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = ['superuser', 'administrator'].includes(auth.auth.role);
  if (!isAdmin && entry.author_id !== auth.auth.uid) {
    return NextResponse.json({ error: 'Forbidden — can only delete your own entries' }, { status: 403 });
  }

  const { error } = await admin
    .from('cr_synergy_unit_activity_logs')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
