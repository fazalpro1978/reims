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
    return NextResponse.json({ backfilled: 0, skipped: 0 });
  }

  let backfilled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const unit of units) {
    const parts = parseMasterCode(unit.master_code ?? '');
    if (!parts) { skipped++; continue; }

    // Resolve type_code from cr_config_type_map
    const { data: typeRow } = await admin
      .from('cr_config_type_map')
      .select('type_code')
      .eq('config_key', String(unit.config ?? ''))
      .maybeSingle();

    const typeCode: string = (typeRow?.type_code as string | null) ?? 'XX';

    // Call atomic RPC to assign (or patch) smart_code
    const { data: assignment, error: rpcError } = await admin.rpc('cr_assign_smart_code', {
      p_category:  parts.category,
      p_entity:    parts.entity,
      p_agent:     parts.agent,
      p_zone_code: parts.zone_code,
      p_type_code: typeCode,
      p_realtor:   String(unit.realtor_name ?? ''),
      p_property:  String(unit.property ?? ''),
      p_unit_no:   String(unit.unit_no ?? ''),
      p_zone_name: String(unit.zone ?? ''),
    });

    if (rpcError || !assignment) {
      errors.push(`Unit ${unit.id}: ${rpcError?.message ?? 'no assignment'}`);
      skipped++;
      continue;
    }

    const newSmartCode: string = (assignment as { smart_code: string }).smart_code;
    if (!newSmartCode) { skipped++; continue; }

    // Write smart_code back to this unit
    const { error: updateError } = await admin
      .from('units')
      .update({ smart_code: newSmartCode, updated_at: new Date().toISOString() })
      .eq('id', unit.id);

    if (updateError) {
      errors.push(`Unit ${unit.id} update: ${updateError.message}`);
      skipped++;
    } else {
      backfilled++;
    }
  }

  return NextResponse.json({
    backfilled,
    skipped,
    total: units.length,
    ...(errors.length ? { errors } : {}),
  });
}
