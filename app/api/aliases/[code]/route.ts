import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { resolveAlias } from '@/lib/aliasEngine';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/aliases/[code] — resolve a single alias and return its unit
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const code = params.code.toUpperCase();
  const resolution = await resolveAlias(code, auth.auth.email, 'admin-panel');

  if (!resolution) {
    return NextResponse.json({ error: `Alias "${code}" not found` }, { status: 404 });
  }

  // Fetch full unit details
  const { data: unit, error } = await admin
    .from('units')
    .select('id, unit_code, unit_no, property, zone, zone_code, type, config, status, rent, furnishing')
    .eq('id', resolution.unitId)
    .single();

  if (error) return NextResponse.json({ error: 'Unit lookup failed' }, { status: 500 });

  return NextResponse.json({ resolution, unit });
}

// GET /api/aliases/[code]/log — resolution history for one alias
export async function DELETE(req: NextRequest, { params }: { params: { code: string } }) {
  // Soft-delete not supported — alias codes are permanent once issued
  return NextResponse.json(
    { error: 'Alias codes are permanent and cannot be deleted' },
    { status: 405 },
  );
}
