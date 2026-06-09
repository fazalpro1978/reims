import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Sanitise: only allow paths within unit-documents
  if (path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const { data, error } = await admin.storage
    .from('unit-documents')
    .createSignedUrl(path, 3600); // 1-hour expiry

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
