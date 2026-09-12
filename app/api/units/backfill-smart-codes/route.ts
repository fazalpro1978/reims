import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../../lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Parse a 16-char master_code into its component parts.
// Format: {Cat(1)}{Entity(3)}{Agent(2)}{Zone(2)}{Date(4)}{Time(4)}
// Example: RAEMSB5508091920
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

  // Fetch all units missing smart_code but having master_code
  const { data: units, error: fetchError } = await admin
    .from('units')
    .select('id, master_code, config, realtor_name, property, unit_no, zone')
    .is('smart_code', null)
    .not('master_code', 'is', null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!units || units.length === 0) {
    return NextResponse.json({ backfilled: 0, skipped: 0, total: 0 });
  }

  // Load the current sequence counters for all relevant buckets up front
  const { data: seqRows } = await admin
    .from('cr_smart_code_sequences')
    .select('entity_code, zone_code, type_code, last_seq');

  // In-memory sequence map: "entity|zone|type" → current last_seq
  const seqMap = new Map<string, number>();
  for (const row of (seqRows ?? [])) {
    const key = `${row.entity_code}|${row.zone_code}|${row.type_code}`;
    seqMap.set(key, row.last_seq as number);
  }

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

    // Resolve type_code from cr_config_type_map
    const { data: typeRow } = await admin
      .from('cr_config_type_map')
      .select('type_code')
      .eq('config_key', String(unit.config ?? ''))
      .maybeSingle();

    const typeCode: string = (typeRow?.type_code as string | null) ?? 'XX';

    // Increment local sequence counter for this bucket
    const bucketKey = `${parts.entity}|${parts.zone_code}|${typeCode}`;
    const nextSeq = (seqMap.get(bucketKey) ?? 0) + 1;
    seqMap.set(bucketKey, nextSeq);

    // Build 14-char smart_code
    const smartCode = parts.category
      + parts.entity
      + parts.agent
      + parts.zone_code
      + typeCode
      + String(nextSeq).padStart(4, '0');

    // Write smart_code to this unit
    const { error: updateError } = await admin
      .from('units')
      .update({ smart_code: smartCode, updated_at: new Date().toISOString() })
      .eq('id', unit.id);

    if (updateError) {
      errors.push(`Unit ${unit.id} update: ${updateError.message}`);
      // Roll back local seq so gap doesn't form — next unit gets this slot
      seqMap.set(bucketKey, nextSeq - 1);
      skipped++;
    } else {
      backfilled++;
    }
  }

  // Persist updated sequence counters back to cr_smart_code_sequences
  const upsertRows = Array.from(seqMap.entries()).map(([key, last_seq]) => {
    const [entity_code, zone_code, type_code] = key.split('|');
    return { entity_code, zone_code, type_code, last_seq, updated_at: new Date().toISOString() };
  });

  if (upsertRows.length > 0) {
    await admin
      .from('cr_smart_code_sequences')
      .upsert(upsertRows, { onConflict: 'entity_code,zone_code,type_code' });
  }

  return NextResponse.json({
    backfilled,
    skipped,
    total: units.length,
    ...(errors.length ? { errors } : {}),
  });
}
