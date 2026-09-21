import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../../lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Canonical type-code map — upserted on every run so the table stays in sync.
const DEFAULT_TYPE_MAP: Record<string, string> = {
  'Studio':     'ST',
  '1 BHK':      '1B',
  '2 BHK':      '2B',
  '3 BHK':      '3B',
  '4 BHK':      '4B',
  '5 BHK':      '5B',
  'Penthouse':  'PH',
  'Villa':      'VL',
  'Duplex':     'DP',
  'Townhouse':  'TH',
};

function parseMasterCode(mc: string): {
  category: string; entity: string; agent: string; zone_code: string;
} | null {
  if (!mc || mc.length < 8) return null;
  return {
    category:  mc[0],
    entity:    mc.slice(1, 4),
    agent:     mc.slice(4, 6),
    zone_code: mc.slice(6, 8),
  };
}

export async function POST(req: Request) {
  const authResult = await requireAuth(req as Parameters<typeof requireAuth>[0]);
  if (!authResult.ok) return authResult.response;

  // ── 1. Seed cr_config_type_map (idempotent, best-effort) ────────────────────
  // If the table doesn't exist the error is ignored; DEFAULT_TYPE_MAP is the fallback.
  // best-effort — ignored if cr_config_type_map doesn't exist; DEFAULT_TYPE_MAP is the fallback
  await admin
    .from('cr_config_type_map')
    .upsert(
      Object.entries(DEFAULT_TYPE_MAP).map(([config_key, type_code]) => ({ config_key, type_code })),
      { onConflict: 'config_key' },
    );

  // ── 2. Load type map ─────────────────────────────────────────────────────────
  const { data: typeMapRows } = await admin
    .from('cr_config_type_map')
    .select('config_key, type_code');

  const typeCache = new Map<string, string>();
  for (const row of (typeMapRows ?? [])) {
    typeCache.set(row.config_key as string, row.type_code as string);
  }

  // ── 3. Scan existing smart codes to seed per-bucket sequence maximums ─────────
  // This prevents collisions: new assignments continue from the DB's current high-water mark,
  // never overlapping codes that are already assigned and immutable.
  const { data: existing } = await admin
    .from('units')
    .select('smart_code')
    .not('smart_code', 'is', null);

  const seqMap = new Map<string, number>();
  for (const row of (existing ?? [])) {
    const sc = row.smart_code as string | null;
    if (!sc || sc.length !== 14) continue;
    const bucket = sc.slice(0, 10);   // Cat(1)+Entity(3)+Agent(2)+Zone(2)+TypeCode(2)
    const seq = parseInt(sc.slice(10), 10);
    if (!isNaN(seq) && seq > (seqMap.get(bucket) ?? 0)) seqMap.set(bucket, seq);
  }

  // ── 4. Fetch only units missing a smart_code (master_code required for parsing) ─
  const { data: units, error: fetchError } = await admin
    .from('units')
    .select('id, master_code, config')
    .is('smart_code', null)
    .not('master_code', 'is', null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!units || units.length === 0) {
    return NextResponse.json({ backfilled: 0, skipped: 0, total: 0 });
  }

  // ── 5. Backfill null smart_codes ─────────────────────────────────────────────
  // seqMap already seeded from existing codes — no purge, no collisions.
  let backfilled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const unit of units) {
    const parts = parseMasterCode(unit.master_code ?? '');
    if (!parts) {
      errors.push(`Unit ${unit.id}: master_code too short ("${unit.master_code}")`);
      skipped++;
      continue;
    }

    const config = String(unit.config ?? '').trim();
    // DB table is authoritative; DEFAULT_TYPE_MAP is the in-memory fallback
    // so type codes resolve correctly even if cr_config_type_map doesn't exist.
    const typeCode = typeCache.get(config) ?? DEFAULT_TYPE_MAP[config] ?? 'XX';
    const bucketKey = `${parts.entity}|${parts.agent}|${parts.zone_code}|${typeCode}`;
    const nextSeq = (seqMap.get(bucketKey) ?? 0) + 1;
    seqMap.set(bucketKey, nextSeq);

    const smartCode =
      parts.category +
      parts.entity +
      parts.agent +
      parts.zone_code +
      typeCode +
      String(nextSeq).padStart(4, '0');

    const { error: updateError } = await admin
      .from('units')
      .update({ smart_code: smartCode, updated_at: new Date().toISOString() })
      .eq('id', unit.id);

    if (updateError) {
      errors.push(`Unit ${unit.id}: ${updateError.message}`);
      skipped++;
    } else {
      backfilled++;
    }
  }

  // ── 6. Persist sequence counters ─────────────────────────────────────────────
  const upsertRows = Array.from(seqMap.entries()).map(([key, last_seq]) => {
    const [entity_code, , zone_code, type_code] = key.split('|');
    return { entity_code, zone_code, type_code, last_seq, updated_at: new Date().toISOString() };
  });

  if (upsertRows.length > 0) {
    await admin
      .from('cr_smart_code_sequences')
      .upsert(upsertRows, { onConflict: 'entity_code,zone_code,type_code' });
  }

  // ── 7. Sync unit_snapshot.smart_code in inquiry_matches ──────────────────────
  let snapshotsSynced = 0;
  if (backfilled > 0) {
    const updatedIds = units.map(u => u.id);
    const { data: freshUnits } = await admin
      .from('units')
      .select('id, smart_code')
      .in('id', updatedIds)
      .not('smart_code', 'is', null);

    for (const fu of (freshUnits ?? [])) {
      if (!fu.smart_code) continue;
      const { data: matches } = await admin
        .from('inquiry_matches')
        .select('id, unit_snapshot')
        .eq('unit_id', fu.id);

      for (const match of (matches ?? [])) {
        const snap = (match.unit_snapshot as Record<string, unknown>) ?? {};
        if (snap.smart_code === fu.smart_code) continue;
        await admin
          .from('inquiry_matches')
          .update({ unit_snapshot: { ...snap, smart_code: fu.smart_code } })
          .eq('id', match.id);
        snapshotsSynced++;
      }
    }
  }

  return NextResponse.json({
    backfilled,
    skipped,
    total: units.length,
    snapshotsSynced,
    ...(errors.length ? { errors } : {}),
  });
}
