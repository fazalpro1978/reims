import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const BUCKET = 'circle-of-excellence';
const PREVIEW_TTL = 60 * 60; // 1 h — enough for the admin to finish editing

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const slot = formData.get('slot') as string | null; // 'photo' | 'certificate'

  if (!file || !slot) {
    return NextResponse.json({ error: 'Missing file or slot' }, { status: 400 });
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path     = `${slot}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());
  const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';

  // Bucket must be PRIVATE — created manually in Supabase dashboard
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Short-lived signed URL for the in-editor preview only — never stored in DB
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, PREVIEW_TTL);

  return NextResponse.json({
    path,                              // stored in DB
    previewUrl: signed?.signedUrl ?? '', // used by the edit form preview only
    fileType,
  });
}
