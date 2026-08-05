import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Returns the existing alias for a unit, or creates a new one.
 * zoneCode must match a row in alias_zone_tags.
 */
export async function getOrCreateAlias(
  unitId: string,
  zoneCode: number,
  createdBy?: string,
): Promise<string> {
  // 1. Return existing
  const { data: existing } = await admin
    .from('alias_registry')
    .select('alias_code')
    .eq('unit_id', unitId)
    .maybeSingle();
  if (existing?.alias_code) return existing.alias_code;

  // 2. Resolve zone tag
  const { data: zoneRow, error: zoneErr } = await admin
    .from('alias_zone_tags')
    .select('zone_tag')
    .eq('zone_code', zoneCode)
    .single();
  if (zoneErr || !zoneRow) throw new Error(`No alias zone tag for zone_code ${zoneCode}`);
  const tag = zoneRow.zone_tag as string;

  // 3. Atomic counter increment via DB function
  const { data: seqData, error: seqErr } = await admin.rpc('alias_next_seq', { p_zone_code: zoneCode });
  if (seqErr || seqData == null) throw new Error(`alias_next_seq failed: ${seqErr?.message}`);
  const seq: number = seqData;

  // Format: TAG(2) + ZONEPAD(2) + "-" + SEQ(3) = 8 chars, e.g. "WB61-023"
  const zonePad = String(zoneCode).slice(-2).padStart(2, '0');
  const aliasCode = `${tag}${zonePad}-${String(seq).padStart(3, '0')}`;

  // 4. Write to registry and back-fill units.alias_code in one shot
  const { error: insErr } = await admin.from('alias_registry').insert({
    alias_code: aliasCode,
    unit_id:    unitId,
    zone_code:  zoneCode,
    zone_index: seq,
    created_by: createdBy ?? null,
  });
  if (insErr) {
    // Concurrent insert race — re-read and return whatever won
    const { data: race } = await admin
      .from('alias_registry')
      .select('alias_code')
      .eq('unit_id', unitId)
      .single();
    if (race?.alias_code) return race.alias_code;
    throw new Error(`alias_registry insert failed: ${insErr.message}`);
  }

  // Cache on the unit row so queries can read it directly
  await admin.from('units').update({ alias_code: aliasCode }).eq('id', unitId);

  return aliasCode;
}

export interface AliasResolution {
  aliasCode: string;
  unitId: string;
  zoneCode: number;
  zoneIndex: number;
  createdAt: string;
}

/**
 * Resolves an alias code to its unit, and logs the lookup.
 * Returns null if the alias doesn't exist.
 */
export async function resolveAlias(
  aliasCode: string,
  resolvedBy?: string,
  context?: string,
): Promise<AliasResolution | null> {
  const { data, error } = await admin
    .from('alias_registry')
    .select('alias_code, unit_id, zone_code, zone_index, created_at')
    .eq('alias_code', aliasCode.toUpperCase())
    .maybeSingle();

  if (error || !data) return null;

  // Log the lookup (fire-and-forget)
  void admin.from('alias_resolution_log').insert({
    alias_code:  data.alias_code,
    resolved_by: resolvedBy ?? null,
    context:     context ?? null,
  });

  return {
    aliasCode:  data.alias_code,
    unitId:     data.unit_id,
    zoneCode:   data.zone_code,
    zoneIndex:  data.zone_index,
    createdAt:  data.created_at,
  };
}
