import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q           = searchParams.get('q')?.trim();
  const mime        = searchParams.get('mime');
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200);

  let query = admin.from('contracts').select('*').order('drive_modified_at', { ascending: false }).limit(limit);

  if (q) {
    query = query.or(`name.ilike.%${q}%,client_name.ilike.%${q}%,asset_token.ilike.%${q}%`);
  }
  if (mime) {
    query = query.eq('mime_type', mime);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}
