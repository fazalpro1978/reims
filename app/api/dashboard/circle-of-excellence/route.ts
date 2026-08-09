import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { data } = await admin
    .from('circle_of_excellence')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ spotlight: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const body = await req.json();

  const { data: existing } = await admin
    .from('circle_of_excellence')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    employee_name:    body.employee_name    ?? '',
    employee_title:   body.employee_title   ?? null,
    month_year:       body.month_year       ?? null,
    message:          body.message          ?? null,
    photo_url:        body.photo_url        ?? null,
    certificate_url:  body.certificate_url  ?? null,
    certificate_type: body.certificate_type ?? null,
    is_active:        true,
    published_by:     auth.auth.uid,
    updated_at:       new Date().toISOString(),
  };

  let result;
  if (existing?.id) {
    result = await admin
      .from('circle_of_excellence')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
  } else {
    result = await admin
      .from('circle_of_excellence')
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ spotlight: result.data });
}
