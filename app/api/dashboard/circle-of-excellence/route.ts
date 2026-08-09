import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const BUCKET  = 'circle-of-excellence';
const VIEW_TTL = 60 * 60 * 24; // 24 h

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function signPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, VIEW_TTL);
  return data?.signedUrl ?? null;
}

// Attach photo_signed_url / cert_signed_url without touching the stored paths
async function hydrate(row: Record<string, unknown>) {
  const [photoSigned, certSigned] = await Promise.all([
    signPath(row.photo_url as string | null),
    signPath(row.certificate_url as string | null),
  ]);
  return { ...row, photo_signed_url: photoSigned, cert_signed_url: certSigned };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { data } = await admin
    .from('circle_of_excellence')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ spotlight: null });
  return NextResponse.json({ spotlight: await hydrate(data) });
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

  // photo_url / certificate_url are PATHS (e.g. "photo/uuid.png"), not URLs
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
  return NextResponse.json({ spotlight: await hydrate(result.data) });
}
