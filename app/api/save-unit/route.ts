import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 }
    );
  }
}
