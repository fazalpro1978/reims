import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — never sent to the browser
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const path = form.get('path') as string | null;

    if (!file || !path) {
      return NextResponse.json({ error: 'file and path are required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}. Accepted: PDF, JPEG, PNG, WebP` },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 400 });
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { data, error } = await admin.storage
      .from('unit-documents')
      .upload(path, buffer, {
        contentType:  file.type,
        upsert:       true,
        cacheControl: '3600',
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ path: data.path });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
