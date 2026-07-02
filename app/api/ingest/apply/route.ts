import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const INGEST_URL = process.env.INGEST_SERVICE_URL ?? 'https://d-inges.vercel.app';
const INGEST_KEY = process.env.INGEST_API_KEY ?? '';

type VettedRecord = { id: string; payload: Record<string, unknown> };

// Exhaustive set of columns that exist in public.units (initial schema + parity migration).
// Any dInges payload field not in this set (e.g. area_sqft, notes, bedrooms, floor)
// is stripped before insert/update to prevent Supabase schema-cache errors.
const UNITS_COLUMNS = new Set([
  'realtor_name', 'realtor_moci',
  'property', 'unit_no', 'zone_code', 'zone', 'type', 'config',
  'bathrooms', 'parking', 'kitchen',
  'furnishing', 'listing_type', 'status',
  'rent', 'service_charges', 'deposit_amount', 'agency_fee',
  'moci_contract_number', 'moci_contract_status',
  'legal_duration', 'contract_start_date', 'contract_end_date',
  'location_map_url', 'media_url', 'asset_history_links',
  'listed_date', 'unit_code', 'amenities',
  'kahramaa_applicable', 'kahramaa_amount',
  'qatar_cool_applicable', 'qatar_cool_amount',
  'marafeq_applicable', 'marafeq_amount',
  'updated_at',
]);

// Map dInges canonical values → REIMS DB enum values
const FURNISHING_MAP: Record<string, string> = {
  'Furnished':      'Fully Furnished',  // dInges normalises to 'Furnished'; DB enum is 'Fully Furnished'
  'Semi-Furnished': 'Semi-Furnished',
  'Unfurnished':    'Unfurnished',
};

const STATUS_MAP: Record<string, string> = {
  'Available':       'Available',
  'Not Available':   'Leased',          // closest REIMS enum value
  'Reserved':        'Reserved',
  'Under Preparation': 'Under_Maintenance',
};

function normaliseEnums(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  if (typeof out.furnishing === 'string') {
    out.furnishing = FURNISHING_MAP[out.furnishing] ?? out.furnishing;
  }
  if (typeof out.status === 'string') {
    // Handle 'Awaiting Activation on dd/mm/yy' and any other freeform values
    out.status = STATUS_MAP[out.status] ?? (
      String(out.status).startsWith('Awaiting') ? 'Reserved' : 'Available'
    );
  }
  return out;
}

function toUnitRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (UNITS_COLUMNS.has(k)) out[k] = v;
  }
  return normaliseEnums(out);
}

export async function POST(req: NextRequest) {
  try {
    const { records } = (await req.json()) as { records: VettedRecord[] };
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records[] required' }, { status: 400 });
    }

    // ── 1. Upsert into public.units ─────────────────────────────────────────
    // Strip payload fields that don't exist in the units table before writing
    const rows = records.map((r) => r.payload);
    const unitCodes = rows
      .map((r) => r.unit_code)
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '');

    const { data: existing } = await admin
      .from('units')
      .select('id, unit_code')
      .in('unit_code', unitCodes);

    const existingMap = new Map(
      (existing ?? []).map((r: { id: string; unit_code: string }) => [r.unit_code, r.id]),
    );

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
    const toReplace: { id: string; data: Record<string, unknown> }[] = [];

    for (const row of rows) {
      const { __force_delete, ...rawData } = row;
      const data = toUnitRow(rawData);
      const code = data.unit_code as string;
      const existingId = existingMap.get(code);
      if (existingId && __force_delete) {
        toReplace.push({ id: existingId, data });
      } else if (existingId) {
        toUpdate.push({ id: existingId, data: { ...data, updated_at: new Date().toISOString() } });
      } else {
        toInsert.push(data);
      }
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // Delete & re-insert fresh for rows explicitly flagged __force_delete
    for (const { id, data } of toReplace) {
      const { error: delErr } = await admin.from('units').delete().eq('id', id);
      if (delErr) { errors.push(`Delete ${data.unit_code}: ${delErr.message}`); continue; }
      const { error: insErr } = await admin.from('units').insert(toUnitRow(data));
      if (insErr) errors.push(`Re-insert ${data.unit_code}: ${insErr.message}`);
      else inserted++;
    }

    if (toInsert.length > 0) {
      const { error } = await admin.from('units').insert(toInsert);
      if (error) errors.push(`Bulk insert: ${error.message}`);
      else inserted += toInsert.length;
    }

    for (const { id, data } of toUpdate) {
      const { error } = await admin.from('units').update(data).eq('id', id);
      if (error) errors.push(`Update ${data.unit_code}: ${error.message}`);
      else updated++;
    }

    // ── 2. Acknowledge back to dInges ───────────────────────────────────────
    let acknowledged = 0;
    if (INGEST_KEY) {
      const ids = records.map((r) => r.id);
      try {
        const ackRes = await fetch(`${INGEST_URL}/api/export/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': INGEST_KEY },
          body: JSON.stringify({ ids }),
        });
        if (ackRes.ok) acknowledged = ids.length;
      } catch {
        errors.push('Acknowledgement to dInges failed — records were imported but remain in the vetted queue.');
      }
    }

    return NextResponse.json({ inserted, updated, acknowledged, errors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Apply failed' }, { status: 500 });
  }
}
