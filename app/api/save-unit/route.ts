import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Master registry sync ──────────────────────────────────────────────────────
// Generates a collision-free 3-char entity code for cr_entity_codes
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

async function syncMasterRecords(fields: Record<string, unknown>): Promise<void> {
  // 1. Realtor → public.realtors (insert if new) + cr_entity_codes
  const realtorName = typeof fields.realtor_name === 'string' ? fields.realtor_name.trim() : '';
  const realtorMoci = typeof fields.realtor_moci === 'string' ? fields.realtor_moci.trim() || null : null;

  if (realtorName) {
    const { data: existing } = await admin
      .from('realtors')
      .select('id')
      .ilike('name', realtorName)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { data: created } = await admin
        .from('realtors')
        .insert({ name: realtorName, moci_id: realtorMoci })
        .select('id, name, classification')
        .single();

      if (created) {
        // Sync into Code Registry so entity dropdowns pick it up
        const { data: ecExisting } = await admin
          .from('cr_entity_codes')
          .select('entity_code')
          .ilike('company_name', realtorName)
          .limit(1)
          .maybeSingle();

        if (!ecExisting) {
          const code = await generateEntityCode(realtorName);
          if (code) {
            await admin.from('cr_entity_codes').insert({
              entity_code:    code,
              company_name:   realtorName,
              classification: created.classification || 'Independent',
              is_manual:      true,
            });
          }
        }
      }
    }
  }

  // 2. Zone → public.cr_zone_codes (insert if zone_code not yet registered)
  const zoneName = typeof fields.zone === 'string' ? fields.zone.trim() : '';
  const zoneCode = Number(fields.zone_code);

  if (zoneName && Number.isInteger(zoneCode) && zoneCode > 0) {
    await admin
      .from('cr_zone_codes')
      .upsert(
        { zone_code: zoneCode, district_name: zoneName },
        { onConflict: 'zone_code', ignoreDuplicates: true },
      );
  }
}

// Explicit allowlist — prevents mass-assignment of internal/system columns
const ALLOWED_FIELDS = new Set([
  'realtor_name', 'realtor_moci',
  'property', 'unit_no', 'zone_code', 'zone', 'type', 'config',
  'bathrooms', 'parking', 'kitchen', 'furnishing', 'listing_type', 'status',
  'rent', 'service_charges', 'deposit_amount', 'agency_fee',
  'moci_contract_number', 'moci_contract_status',
  'legal_duration', 'contract_start_date', 'contract_end_date',
  'location_map_url', 'media_url', 'asset_history_links',
  'listed_date', 'amenities',
  'kahramaa_applicable', 'kahramaa_amount',
  'qatar_cool_applicable', 'qatar_cool_amount',
  'marafeq_applicable', 'marafeq_amount',
  'remarks', 'notes',
]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  try {
    const { unitUuid, fields } = await req.json() as {
      unitUuid: string;
      fields: Record<string, unknown>;
    };

    if (!unitUuid || typeof unitUuid !== 'string') {
      return NextResponse.json({ error: 'unitUuid is required' }, { status: 400 });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields object is required' }, { status: 400 });
    }

    // Strip any field not in the allowlist
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (ALLOWED_FIELDS.has(k)) safe[k] = v;
    }

    if (Object.keys(safe).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await admin.from('units').update(safe).eq('id', unitUuid);
    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Propagate new realtor/zone values to master registries (non-blocking)
    syncMasterRecords(safe).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 }
    );
  }
}
