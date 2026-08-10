import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

import type { Role } from '@/lib/serverAuth';

const ALL_ROLES: Role[] = ['superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party'];
const AVATAR_BUCKET = 'avatars';
const SIGNED_TTL    = 7200; // 2 hours

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function signAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin().storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ALL_ROLES);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin()
    .from('profiles')
    .select('id, email, full_name, role, department, company, phone, avatar_url, avatar_preset')
    .eq('id', auth.auth.uid)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const avatarSignedUrl = await signAvatarUrl(data.avatar_url);

  return NextResponse.json({ profile: { ...data, avatarSignedUrl } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ALL_ROLES);
  if (!auth.ok) return auth.response;

  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('full_name'     in body) updates.full_name     = body.full_name?.trim()    || null;
  if ('company'       in body) updates.company        = body.company?.trim()      || null;
  if ('phone'         in body) updates.phone          = body.phone?.trim()        || null;
  if ('avatar_preset' in body) updates.avatar_preset  = body.avatar_preset        || null;
  if ('avatar_url'    in body) updates.avatar_url     = body.avatar_url           || null;

  const { error } = await admin()
    .from('profiles')
    .update(updates)
    .eq('id', auth.auth.uid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If a new avatar_url was set, return a fresh signed URL
  const newPath = ('avatar_url' in body) ? (body.avatar_url || null) : undefined;
  const avatarSignedUrl = newPath !== undefined ? await signAvatarUrl(newPath) : undefined;

  return NextResponse.json({ ok: true, ...(avatarSignedUrl !== undefined ? { avatarSignedUrl } : {}) });
}
