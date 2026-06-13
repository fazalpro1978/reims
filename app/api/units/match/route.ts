import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Field merge policy ───────────────────────────────────────────────────────
// 'incoming_wins'  — always apply incoming non-null value
// 'additive'       — fill blanks only, never overwrite existing
// 'manual_review'  — flag as conflict, require human resolution
// 'append'         — combine both values (arrays / notes)

const FIELD_POLICY: Record<string, 'incoming_wins' | 'additive' | 'manual_review' | 'append'> = {
  status:               'incoming_wins',
  rent:                 'incoming_wins',
  service_charges:      'incoming_wins',
  deposit_amount:       'additive',
  agency_fee:           'additive',
  furnishing:           'incoming_wins',
  listing_type:         'incoming_wins',
  type:                 'additive',
  config:               'additive',
  bathrooms:            'additive',
  parking:              'additive',
  kitchen:              'additive',
  zone:                 'additive',
  zone_code:            'additive',
  property:             'additive',
  unit_no:              'additive',
  realtor_name:         'additive',
  realtor_moci:         'additive',
  moci_contract_status: 'manual_review',
  moci_contract_number: 'manual_review',
  legal_duration:       'manual_review',
  contract_start_date:  'manual_review',
  contract_end_date:    'manual_review',
  location_map_url:     'additive',
  notes:                'append',
};

// ─── Text normalisation ───────────────────────────────────────────────────────

function normalise(s: unknown): string {
  if (s == null) return '';
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { records, runId } = (await req.json()) as {
      records: Record<string, unknown>[];
      runId?: string;
    };

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records array required' }, { status: 400 });
    }

    // ── Load existing units (code, property, unit_no) and building aliases ──
    const [unitsRes, aliasRes] = await Promise.all([
      admin.from('units').select('id, unit_code, property, unit_no, status, rent, furnishing, type, config, zone, updated_at'),
      admin.from('building_aliases').select('canonical_name, alias'),
    ]);

    const existingUnits = (unitsRes.data ?? []) as {
      id: string; unit_code: string; property: string; unit_no: string;
      status: string; rent: number; furnishing: string; type: string;
      config: string; zone: string; updated_at: string;
    }[];

    const aliasMap = new Map<string, string>(
      (aliasRes.data ?? []).map((r: { alias: string; canonical_name: string }) => [
        normalise(r.alias), r.canonical_name,
      ]),
    );

    // Build lookup indexes
    const byCode = new Map(existingUnits.map((u) => [u.unit_code?.toLowerCase(), u]));
    const byNaturalKey = new Map(
      existingUnits.map((u) => [`${normalise(u.property)}||${normalise(u.unit_no)}`, u]),
    );

    const resolveBuilding = (raw: unknown): string => {
      const norm = normalise(raw);
      return aliasMap.get(norm) ?? String(raw ?? '');
    };

    // ── Match each incoming record ─────────────────────────────────────────
    const results = records.map((rec, idx) => {
      const incomingCode = String(rec.unit_code ?? '').toLowerCase().trim();
      const resolvedProperty = resolveBuilding(rec.property);
      const naturalKey = `${normalise(resolvedProperty)}||${normalise(rec.unit_no)}`;

      let matched: typeof existingUnits[0] | undefined;
      let matchType: 'exact_code' | 'natural_key' | 'fuzzy' | 'unresolved' = 'unresolved';
      let matchConfidence = 0;

      // 1. Exact unit_code match
      if (incomingCode && byCode.has(incomingCode)) {
        matched = byCode.get(incomingCode);
        matchType = 'exact_code';
        matchConfidence = 1.0;
      }
      // 2. Natural key: normalised property + unit_no
      else if (naturalKey !== '||' && byNaturalKey.has(naturalKey)) {
        matched = byNaturalKey.get(naturalKey);
        matchType = 'natural_key';
        matchConfidence = 0.95;
      }
      // 3. Fuzzy: try each alias variant of property + unit_no
      else if (rec.unit_no) {
        const unitNorm = normalise(rec.unit_no);
        for (const [alias, canonical] of Array.from(aliasMap.entries())) {
          if (normalise(rec.property).includes(alias) || alias.includes(normalise(rec.property))) {
            const fuzzyKey = `${normalise(canonical)}||${unitNorm}`;
            if (byNaturalKey.has(fuzzyKey)) {
              matched = byNaturalKey.get(fuzzyKey);
              matchType = 'fuzzy';
              matchConfidence = 0.75;
              break;
            }
          }
        }
      }

      // ── Build conflict map and resolved data ─────────────────────────────
      const conflictFields: Record<string, { existing: unknown; incoming: unknown }> = {};
      const resolvedData: Record<string, unknown> = { ...rec };

      if (matched) {
        const existing = matched as Record<string, unknown>;
        for (const [field, policy] of Object.entries(FIELD_POLICY)) {
          const inVal = rec[field];
          const exVal = existing[field];

          if (inVal == null || inVal === '') continue; // nothing incoming — skip

          if (policy === 'manual_review' && exVal != null && exVal !== '' && String(inVal) !== String(exVal)) {
            conflictFields[field] = { existing: exVal, incoming: inVal };
            resolvedData[field] = exVal; // keep existing until human resolves
          } else if (policy === 'additive') {
            resolvedData[field] = exVal != null && exVal !== '' ? exVal : inVal;
          } else if (policy === 'append') {
            resolvedData[field] = [exVal, inVal].filter(Boolean).join(' | ');
          } else {
            // incoming_wins
            resolvedData[field] = inVal;
          }
        }
      }

      const hasConflicts = Object.keys(conflictFields).length > 0;
      const action = !matched
        ? 'new'
        : hasConflicts
        ? 'conflict'
        : 'update';

      return {
        rowIndex:         idx,
        unitId:           matched?.id ?? null,
        matchType,
        matchConfidence,
        rawData:          rec,
        resolvedData,
        action,
        conflictFields:   hasConflicts ? conflictFields : null,
        existingSnapshot: matched
          ? { status: matched.status, rent: matched.rent, furnishing: matched.furnishing }
          : null,
      };
    });

    const summary = {
      total:     results.length,
      new:       results.filter((r) => r.action === 'new').length,
      update:    results.filter((r) => r.action === 'update').length,
      conflict:  results.filter((r) => r.action === 'conflict').length,
    };

    return NextResponse.json({ results, summary, runId });
  } catch (err) {
    console.error('[units/match]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Match failed' },
      { status: 500 },
    );
  }
}
