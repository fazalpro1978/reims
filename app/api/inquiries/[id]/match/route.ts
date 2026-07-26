import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine, UnitRow } from '@/lib/matchingEngine';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Load inquiry
    const { data: inquiry, error: inqErr } = await admin
      .from('inquiries')
      .select('*')
      .eq('id', params.id)
      .single();

    if (inqErr || !inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });

    // Load all Available units
    const { data: units, error: unitsErr } = await admin
      .from('units')
      .select('id, unit_code, property, unit_no, zone, zone_code, type, config, rent, bathrooms, furnishing, status, listing_type')
      .eq('status', 'Available');

    if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

    // Run matching engine
    const results = runMatchingEngine(inquiry, (units ?? []) as UnitRow[]);

    // Clear previous matches for this inquiry
    await admin.from('inquiry_matches').delete().eq('inquiry_id', params.id);

    // Insert new matches
    if (results.length > 0) {
      const rows = results.map(r => ({
        inquiry_id:    params.id,
        unit_id:       r.unitId,
        unit_code:     r.unitCode,
        unit_snapshot: r.unitSnapshot,
        match_tier:    r.tier,
        match_score:   r.score,
        match_reasons: r.reasons,
      }));
      await admin.from('inquiry_matches').insert(rows);
    }

    // Update inquiry metadata
    await admin.from('inquiries').update({
      last_matched_at: new Date().toISOString(),
      match_count:     results.length,
    }).eq('id', params.id);

    // Notify if new matches found
    if (results.length > 0) {
      await admin.from('notifications').insert({
        type:           'new_match',
        title:          `${results.length} match${results.length > 1 ? 'es' : ''} found for ${inquiry.client_name}`,
        body:           `Ref ${inquiry.ref_no} · Tier 1: ${results.filter(r => r.tier === 1).length} · Tier 2: ${results.filter(r => r.tier === 2).length} · Tier 3: ${results.filter(r => r.tier === 3).length}`,
        inquiry_id:     params.id,
        assigned_agent: inquiry.assigned_agent ?? null,
      });
    }

    return NextResponse.json({
      matched:  results.length,
      tier1:    results.filter(r => r.tier === 1).length,
      tier2:    results.filter(r => r.tier === 2).length,
      tier3:    results.filter(r => r.tier === 3).length,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Match failed' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin
    .from('inquiry_matches')
    .select('*')
    .eq('inquiry_id', params.id)
    .order('match_tier', { ascending: true })
    .order('match_score', { ascending: false });

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  return NextResponse.json({ matches: data ?? [] });
}
