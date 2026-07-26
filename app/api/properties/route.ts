import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source      = searchParams.get('source');
  const listingType = searchParams.get('listing_type');
  const status      = searchParams.get('status');

  let q = admin.from('properties').select('*').order('created_at', { ascending: false });

  if (source      && source      !== 'all') q = q.eq('source', source);
  if (listingType && listingType !== 'all') q = q.eq('listing_type', listingType);
  if (status      && status      !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ properties: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const row: Record<string, unknown> = {};
    const fields = [
      'title', 'listing_type', 'property_type', 'bedrooms', 'bathrooms',
      'size_sqm', 'floor', 'furnished', 'price', 'price_currency',
      'location', 'zone', 'compound', 'description', 'images', 'amenities',
      'source', 'source_url', 'source_ref', 'status', 'featured',
    ];
    for (const f of fields) {
      if (f in body) row[f] = body[f] ?? null;
    }

    const { data, error } = await admin
      .from('properties')
      .insert(row)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
    return NextResponse.json({ property: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Create failed' }, { status: 500 });
  }
}
