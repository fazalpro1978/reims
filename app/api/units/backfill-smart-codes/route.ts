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

  // ── 1. Seed cr_config_type_map (idempotent) ─────────────────────────────────
  await admin
    .from('cr_config_type_map')
    .upsert(
      Object.entries(DEFAULT_TYPE_MAP).map(([config_key, type_code]) => ({ config_key, type_code })),
      { onConflict: 'config_key' },
    );

  // ── 2. Purge: NULL all smart_codes and wipe sequence counters ────────────────
  // Starting from zero eliminates musical-chairs unique-constraint collisions
  // that occur when in-flight updates race against still-held legacy codes.
  const { error: purgeError } = await admin
    .from('units')
    .update({ smart_code: null })
    .not('id', 'is', null);

  if (purgeError) {
    return NextResponse.json({ error: `Purge failed: ${purgeError.message}` }, { status: 500 });
  }

  await admin
    .from('cr_smart_code_sequences')
    .delete()
    .not('entity_code', 'is', null);

  // ── 3. Fetch all units that have a master_code ───────────────────────────────
  const { data: units, error: fetchError } = await admin
    .from('units')
    .select('id, master_code, config')
    .not('master_code', 'is', null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!units || units.length === 0) {
    return NextResponse.json({ purged: true, backfilled: 0, skipped: 0, total: 0 });
  }

  // ── 4. Load full type map into memory (one query, not N) ─────────────────────
  const { data: typeMapRows } = await admin
    .from('cr_config_type_map')
    .select('config_key, type_code');

  const typeCache = new Map<string, string>();
  for (const row of (typeMapRows ?? [])) {
    typeCache.set(row.config_key as string, row.type_code as string);
  }

  // ── 5. Backfill ──────────────────────────────────────────────────────────────
  // Bucket key = entity|agent|zone|typeCode — mirrors the full 10-char code prefix.
  // Starting from zero with all codes NULLed means no collisions are possible.
  const seqMap = new Map<string, number>();
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

    const typeCode = typeCache.get(String(unit.config ?? '').trim()) ?? 'XX';
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
    purged: true,
    backfilled,
    skipped,
    total: units.length,
    snapshotsSynced,
    ...(errors.length ? { errors } : {}),
  });
}
