import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/inquiries/[id]/attachments
 * Returns all attachments for the inquiry.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker', 'third_party',
  ]);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('inquiry_attachments')
    .select('id, file_name, file_url, file_size, mime_type, uploaded_by, uploaded_by_name, created_at')
    .eq('inquiry_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachments: data ?? [] });
}

/**
 * POST /api/inquiries/[id]/attachments
 * Accepts multipart/form-data with a `file` field.
 * Uploads to Supabase Storage and inserts a DB row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker',
  ]);
  if (!auth.ok) return auth.response;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 });
  }

  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed. Accepted: images, PDF, Word, Excel' },
      { status: 415 },
    );
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${params.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from('inquiry-attachments')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from('inquiry-attachments')
    .getPublicUrl(storagePath);

  const { data: row, error: dbErr } = await admin
    .from('inquiry_attachments')
    .insert({
      inquiry_id:       params.id,
      file_name:        file.name,
      file_url:         urlData.publicUrl,
      file_size:        file.size,
      mime_type:        file.type,
      storage_path:     storagePath,
      uploaded_by:      auth.auth.uid,
      uploaded_by_name: auth.auth.fullName || auth.auth.email,
    })
    .select('id, file_name, file_url, file_size, mime_type, uploaded_by_name, created_at')
    .single();

  if (dbErr) {
    // Clean up orphaned storage file
    await admin.storage.from('inquiry-attachments').remove([storagePath]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ attachment: row }, { status: 201 });
}
