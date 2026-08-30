import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../../lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const INGEST_URL = process.env.INGEST_SERVICE_URL ?? 'https://axiom.propertyscape.io';
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
  'listed_date', 'unit_code', 'amenities', 'view', 'view_types', 'design_type',
  'kahramaa_applicable', 'kahramaa_amount',
  'qatar_cool_applicable', 'qatar_cool_amount',
  'marafeq_applicable', 'marafeq_amount',
  'smart_code', 'master_code',
  'updated_at',
]);

// Valid REIMS view_types — view values that match these are also appended to view_types[]
const REIMS_VIEW_TYPES = new Set([
  'Beach View', 'Canal View', 'City View', 'Clubhouse View', 'Community View',
  'Countryside View', 'Courtyard View', 'Desert View', 'Downtown View',
  'Garden View', 'Golf Course View', 'Greenery View', 'Lake View', 'Lagoon View',
  'Landmark View', 'Main Road View', 'Marina View', 'Mountain View', 'Nature View',
  'Neighbourhood View', 'Ocean View', 'Open View', 'Panoramic View', 'Park View',
  'Partial View', 'Playground View', 'Pool View', 'River View', 'Sea View',
  'Skyline View', 'Sports View', 'Street View', 'Sunrise View', 'Sunset View',
  'Swimming Pool View', 'Unobstructed View', 'Waterfront View',
  'Porto Arabia View',
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

// DB kitchen_type enum: 'Open' | 'Closed' | 'Yes' | 'Pantry'
// dInges may send any casing — normalise by lowercase lookup
const KITCHEN_MAP: Record<string, string> = {
  'open':   'Open',
  'closed': 'Closed',
  'yes':    'Yes',
  'pantry': 'Pantry',
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
  if (typeof out.kitchen === 'string') {
    out.kitchen = KITCHEN_MAP[out.kitchen.toLowerCase()] ?? out.kitchen;
  }
  // Convert 'Yes'/'No' string from Validation table to boolean for the DB column
  if (typeof out.parking === 'string') {
    out.parking = ['yes', 'true', '1', 'y'].includes(String(out.parking).toLowerCase());
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
  const auth = await requireAuth(req, ['superuser', 'administrator']);
  if (!auth.ok) return auth.response;

  try {
    const { records } = (await req.json()) as { records: VettedRecord[] };
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records[] required' }, { status: 400 });
    }

    // ── 0. Build realtor name → moci_id lookup map ──────────────────────────
    // Spreadsheets often omit the Realtor MoCI ID column. If a row has
    // realtor_name but no realtor_moci, we fill it in from the realtors table.
    const { data: realtorRows } = await admin
      .from('realtors')
      .select('name, moci_id');
    const realtorMociMap = new Map<string, string>(
      (realtorRows ?? [])
        .filter((r: { name: string; moci_id: string | null }) => r.name && r.moci_id)
        .map((r: { name: string; moci_id: string }) => [r.name.toLowerCase().trim(), r.moci_id]),
    );

    // ── 1. Upsert into public.units ─────────────────────────────────────────
    // Strip payload fields that don't exist in the units table before writing
    const rows = records.map((r) => {
      const payload = { ...r.payload };

      // Legacy field migration: maid_room and wifi were deprecated standalone
      // boolean fields; they are now consolidated under amenities[].
      // Handle any in-flight vetted_records that still carry the old shape.
      const curAmenities: string[] = Array.isArray(payload.amenities) ? payload.amenities as string[] : [];
      if (payload.maid_room === true || payload.maid_room === 'true') {
        if (!curAmenities.includes('Maids Room')) curAmenities.push('Maids Room');
      }
      if (payload.wifi === true || payload.wifi === 'true') {
        if (!curAmenities.includes('WiFi')) curAmenities.push('WiFi');
      }
      if (curAmenities.length > 0) payload.amenities = curAmenities;
      delete payload.maid_room;
      delete payload.wifi;

      // Auto-fill realtor_moci from realtors table when the column is absent
      if (!payload.realtor_moci && payload.realtor_name) {
        const key = String(payload.realtor_name).toLowerCase().trim();
        const moci = realtorMociMap.get(key);
        if (moci) payload.realtor_moci = moci;
      }
      return payload;
    });
    const unitCodes = rows
      .map((r) => r.unit_code)
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '');

    const { data: existing } = await admin
      .from('units')
      .select('id, unit_code, view_types')
      .in('unit_code', unitCodes);

    const existingMap = new Map(
      (existing ?? []).map((r: { id: string; unit_code: string; view_types: string[] | null }) => [r.unit_code, r]),
    );

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
    const toReplace: { id: string; data: Record<string, unknown> }[] = [];
    const toPatch: { property: string; unit_no: string; smart_code: string | null; master_code: string | null }[] = [];

    for (const row of rows) {
      // Backfill path: only write smart_code + master_code onto an existing unit
      if (row.__patch_only === true) {
        toPatch.push({
          property:    String(row.property   ?? ''),
          unit_no:     String(row.unit_no    ?? ''),
          smart_code:  row.smart_code  != null ? String(row.smart_code)  : null,
          master_code: row.master_code != null ? String(row.master_code) : null,
        });
        continue;
      }

      const { __force_delete, ...rawData } = row;
      const data = toUnitRow(rawData);
      const code = data.unit_code as string;
      const existingRow = existingMap.get(code);

      // If view is a valid REIMS view_type, merge it into view_types[]
      const viewVal = typeof rawData.view === 'string' ? rawData.view.trim() : '';
      if (viewVal && REIMS_VIEW_TYPES.has(viewVal)) {
        const existing_vt: string[] = existingRow?.view_types ?? [];
        data.view_types = existing_vt.includes(viewVal) ? existing_vt : [...existing_vt, viewVal];
      }

      const existingId = existingRow?.id ?? null;
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

    // ── 1b. Backfill patches — smart_code + master_code only ───────────────────
    if (toPatch.length > 0) {
      for (const patch of toPatch) {
        if (!patch.property || !patch.unit_no) continue;
        const { data: found } = await admin
          .from('units')
          .select('id')
          .ilike('property', patch.property)
          .ilike('unit_no',  patch.unit_no)
          .limit(1)
          .single();
        if (!found?.id) {
          errors.push(`Backfill patch: unit not found for ${patch.property} / ${patch.unit_no}`);
          continue;
        }
        const { error: patchErr } = await admin
          .from('units')
          .update({ smart_code: patch.smart_code, master_code: patch.master_code, updated_at: new Date().toISOString() })
          .eq('id', found.id);
        if (patchErr) errors.push(`Backfill patch ${patch.unit_no}: ${patchErr.message}`);
        else updated++;
      }
    }

    // ── 1c. Write contact_details → unit_operational ──────────────────────────
    // contact_details format: "Name Phone" — trailing numeric/+ token is phone, rest is name
    const contactRows = rows.filter(
      (r) => typeof r.contact_details === 'string' && (r.contact_details as string).trim(),
    );
    if (contactRows.length > 0) {
      const contactCodes = contactRows
        .map((r) => r.unit_code)
        .filter((c): c is string => typeof c === 'string' && c.trim() !== '');

      const { data: unitIdRows } = await admin
        .from('units')
        .select('id, unit_code')
        .in('unit_code', contactCodes);

      const unitIdMap = new Map(
        (unitIdRows ?? []).map((r: { id: string; unit_code: string }) => [r.unit_code, r.id]),
      );

      for (const row of contactRows) {
        const unitId = unitIdMap.get(row.unit_code as string);
        if (!unitId) continue;
        const raw = String(row.contact_details).trim();
        const parts = raw.split(/\s+/);
        const lastPart = parts[parts.length - 1] ?? '';
        const isPhone = /^[+\d][\d\s\-.()]{5,}$/.test(lastPart);
        const focal_point_phone = isPhone ? lastPart : null;
        const focal_point_name = isPhone ? parts.slice(0, -1).join(' ').trim() : raw;
        if (!focal_point_name) continue;
        await admin
          .from('unit_operational')
          .upsert(
            { unit_id: unitId, focal_point_name, focal_point_phone },
            { onConflict: 'unit_id' },
          );
      }
    }

    // ── 2. Acknowledge back to dInges ───────────────────────────────────────
    // Only acknowledge if at least one record was successfully written to the DB.
    let acknowledged = 0;
    if (inserted + updated === 0) {
      errors.push('No records were written to the database — acknowledgement skipped. Fix the errors above and retry from REIMS.');
    } else {
      const ids = records.map((r) => r.id);
      try {
        const ackRes = await fetch(`${INGEST_URL}/api/export/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': INGEST_KEY },
          body: JSON.stringify({ ids }),
        });
        if (ackRes.ok) {
          acknowledged = ids.length;
        } else {
          const body = await ackRes.text().catch(() => '');
          errors.push(`Acknowledgement to dInges failed (HTTP ${ackRes.status}): ${body.slice(0, 300) || 'no response body'}`);
        }
      } catch (err) {
        errors.push(`Acknowledgement to dInges failed (network error): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ inserted, updated, acknowledged, errors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Apply failed' }, { status: 500 });
  }
}
