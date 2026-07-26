import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin.from('properties').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 404 });
  return NextResponse.json({ property: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const allowed: Record<string, unknown> = {};
    const patchable = [
      'title', 'listing_type', 'property_type', 'bedrooms', 'bathrooms',
      'size_sqm', 'floor', 'furnished', 'price', 'price_currency',
      'location', 'zone', 'compound', 'description', 'images', 'amenities',
      'source_url', 'status', 'featured',
    ];
    for (const k of patchable) {
      if (k in body) allowed[k] = body[k] ?? null;
    }

    const { data, error } = await admin
      .from('properties')
      .update(allowed)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
    return NextResponse.json({ property: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await admin.from('properties').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
