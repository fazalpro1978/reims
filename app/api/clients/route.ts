import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') ?? '';
    const tag    = searchParams.get('tag')    ?? '';
    const optIn  = searchParams.get('opt_in') ?? '';
    const limit  = Math.min(Number(searchParams.get('limit') ?? 200), 500);
    const offset = Number(searchParams.get('offset') ?? 0);

    let query = admin
      .from('clients')
      .select('id, full_name, phone, email, nationality, source, tags, whatsapp_opt_in, whatsapp_opt_in_at, email_opt_in, email_opt_in_at, notes, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      );
    }
    if (tag)            query = query.contains('tags', [tag]);
    if (optIn === 'wa') query = query.eq('whatsapp_opt_in', true);
    if (optIn === 'em') query = query.eq('email_opt_in', true);

    const { data, error } = await query;
    if (error) {
      console.error('[clients GET] Supabase error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, { status: 500 });
    }

    // Get count separately to avoid count:exact issues
    const { count } = await admin.from('clients').select('*', { count: 'exact', head: true });

    return NextResponse.json({ clients: data ?? [], total: count ?? 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[clients GET] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body.full_name?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('clients')
      .insert({
        full_name:          String(body.full_name).trim(),
        phone:              body.phone        || null,
        email:              body.email        || null,
        nationality:        body.nationality  || null,
        source:             body.source       || 'manual',
        tags:               Array.isArray(body.tags) ? body.tags : [],
        whatsapp_opt_in:    body.whatsapp_opt_in    ?? false,
        whatsapp_opt_in_at: body.whatsapp_opt_in    ? new Date().toISOString() : null,
        email_opt_in:       body.email_opt_in       ?? false,
        email_opt_in_at:    body.email_opt_in       ? new Date().toISOString() : null,
        notes:              body.notes        || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505')
        return NextResponse.json({ error: 'A client with this phone number already exists.' }, { status: 409 });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ client: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}
