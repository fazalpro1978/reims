import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

import type { Role } from '@/lib/serverAuth';

const ALL_ROLES: Role[] = ['superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party'];
const AVATAR_BUCKET = 'avatars';
const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const SIGNED_TTL    = 7200;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function ensureBucket() {
  const sb = admin();
  const { error } = await sb.storage.createBucket(AVATAR_BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
  // Ignore "already exists" error
  if (error && !error.message.toLowerCase().includes('exist')) {
    console.warn('createBucket warning:', error.message);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ALL_ROLES);
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only PNG, JPG, or WebP images are supported.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 });
  }

  await ensureBucket();

  const sb   = admin();
  const path = `${auth.auth.uid}/avatar`; // fixed path — upsert replaces previous upload
  const buf  = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage
    .from(AVATAR_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Persist path in profiles
  await sb.from('profiles').update({ avatar_url: path, avatar_preset: null, updated_at: new Date().toISOString() }).eq('id', auth.auth.uid);

  // Return fresh signed URL for immediate display
  const { data: signed } = await sb.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_TTL);

  return NextResponse.json({ ok: true, path, signedUrl: signed?.signedUrl ?? null });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, ALL_ROLES);
  if (!auth.ok) return auth.response;

  const sb   = admin();
  const path = `${auth.auth.uid}/avatar`;

  // Remove from storage (ignore error if file doesn't exist)
  await sb.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});

  // Clear avatar_url in profile
  const { error } = await sb
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', auth.auth.uid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
