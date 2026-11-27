import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff', 'agent', 'broker']);
  if (!auth.ok) return auth.response;
  const { data, error } = await admin.from('properties').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 404 });
  return NextResponse.json({ property: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const allowed: Record<string, unknown> = {};
    const patchable = [
      'title', 'listing_type', 'property_type', 'bedrooms', 'bathrooms',
      'size_sqm', 'floor', 'furnished', 'price', 'price_currency',
      'location', 'zone', 'compound', 'description', 'images', 'amenities',
      'source_url', 'status', 'featured',
      'title_ar', 'description_ar', 'contact_name', 'contact_phone',
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Deleting a listing is limited to Administrator / Superuser
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;
  const { error } = await admin.from('properties').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
