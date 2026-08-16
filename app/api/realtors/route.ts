import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/serverAuth';
import { registry as admin } from '../../../lib/registryClient';

export const dynamic = 'force-dynamic';

// Generates a unique 3-char entity code for cr_entity_codes sync
async function generateEntityCode(name: string): Promise<string | null> {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(3, '0');
  const candidates = [
    base.slice(0, 3),
    base[0] + base.slice(2, 4),
    base[0] + (base[Math.floor(base.length / 2)] ?? '0') + (base[base.length - 1] ?? '0'),
  ].map(c => c.slice(0, 3).padEnd(3, '0').toUpperCase());

  for (const code of candidates) {
    const { data } = await admin.from('cr_entity_codes').select('entity_code').eq('entity_code', code).limit(1).maybeSingle();
    if (!data) return code;
  }
  for (let i = 0; i < 20; i++) {
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    const { data } = await admin.from('cr_entity_codes').select('entity_code').eq('entity_code', rand).limit(1).maybeSingle();
    if (!data) return rand;
  }
  return null;
}

// Syncs a realtor into cr_entity_codes so Code Registry Developer/Company picks it up
async function syncToEntityCodes(name: string, classification: string | null): Promise<void> {
  const { data: existing } = await admin
    .from('cr_entity_codes')
    .select('entity_code')
    .ilike('company_name', name)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const entityCode = await generateEntityCode(name);
  if (!entityCode) return;

  await admin.from('cr_entity_codes').insert({
    entity_code: entityCode,
    company_name: name,
    classification: classification || 'Independent',
    is_manual: true,
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('realtors')
    .select('id, name, moci_id, classification')
    .order('name');
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ realtors: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const { id, name, moci_id, classification } = body as {
    id?: string; name?: string; moci_id?: string | null; classification?: string | null;
  };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // Capture old name before update so we can match units by it
  const { data: before } = await admin.from('realtors').select('name').eq('id', id).single();
  const oldName = before?.name ?? null;

  const row = {
    name: name.trim(),
    moci_id: moci_id?.trim() || null,
    classification: classification?.trim() || null,
  };
  const { data, error } = await admin
    .from('realtors').update(row).eq('id', id)
    .select('id, name, moci_id, classification').single();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

  // Cascade to all units carrying this realtor's name
  if (oldName) {
    await admin.from('units')
      .update({ realtor_name: row.name, realtor_moci: row.moci_id })
      .ilike('realtor_name', oldName);
  }

  // Sync update into cr_entity_codes too
  await admin.from('cr_entity_codes')
    .update({ company_name: row.name, classification: row.classification || 'Independent' })
    .ilike('company_name', name.trim());

  return NextResponse.json({ realtor: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { error } = await admin.from('realtors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const { id, name, moci_id, classification } = body as {
    id?: string;
    name?: string;
    moci_id?: string | null;
    classification?: string | null;
  };
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const row = {
    name: name.trim(),
    moci_id: moci_id?.trim() || null,
    classification: classification?.trim() || null,
  };
  const { data, error } = id
    ? await admin.from('realtors').update(row).eq('id', id).select('id, name, moci_id, classification').single()
    : await admin.from('realtors').insert(row).select('id, name, moci_id, classification').single();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

  if (!id) {
    // New realtor: sync into Code Registry and backfill units already
    // carrying this realtor name (e.g. imported before the realtor entry existed)
    syncToEntityCodes(data.name, data.classification).catch(() => {});
    await admin.from('units')
      .update({ realtor_name: data.name, realtor_moci: data.moci_id ?? null })
      .ilike('realtor_name', data.name);
  } else {
    // Upsert path (id supplied): cascade same as PUT
    const { data: before } = await admin.from('realtors').select('name').eq('id', id).single();
    if (before?.name) {
      await admin.from('units')
        .update({ realtor_name: data.name, realtor_moci: data.moci_id ?? null })
        .ilike('realtor_name', before.name);
    }
  }

  return NextResponse.json({ realtor: data });
}
