import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine, UnitRow } from '@/lib/matchingEngine';
import { requireAuth, isExternal, isThirdParty } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNIT_DETAIL_THRESHOLD = 60;

function scrubMatch(m: Record<string, unknown>, role: string) {
  const score = m.match_score as number;

  if (isExternal(role as never)) {
    const snap = m.unit_snapshot as Record<string, unknown> | null;

    // Score ≤ 60: return score/tier only, no unit details
    if (!snap || score <= UNIT_DETAIL_THRESHOLD) {
      return {
        id:             m.id,
        match_tier:     m.match_tier,
        match_score:    m.match_score,
        is_shortlisted: m.is_shortlisted,
        unit_snapshot:  null,
        unit_code:      null,
        match_reasons:  null,
      };
    }

    // Score > 60: strip internal identifiers; alias_code becomes the only unit identifier
    const { property: _p, unit_no: _u, id: _id, ...safeSnap } = snap;
    return {
      id:             m.id,
      unit_id:        m.unit_id,   // needed for PDF/WA/Email handlers
      match_tier:     m.match_tier,
      match_score:    m.match_score,
      is_shortlisted: m.is_shortlisted,
      unit_code:      null,
      unit_snapshot:  safeSnap,
      // third_party gets no reasons tags; agent/broker do
      match_reasons:  isThirdParty(role as never) ? null : m.match_reasons,
    };
  }

  return m;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser','administrator','staff','agent','broker','third_party']);
  if (!auth.ok) return auth.response;

  try {
    // Load inquiry — ownership enforced: external roles can only re-run their own
    const inqQuery = admin.from('inquiries').select('*').eq('id', params.id);
    const { data: inquiry, error: inqErr } = await (
      isExternal(auth.auth.role)
        ? inqQuery.eq('staff_email', auth.auth.email)
        : inqQuery
    ).single();

    if (inqErr || !inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });

    // third_party cannot re-run
    if (isThirdParty(auth.auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load all Available units — include alias_code
    const { data: units, error: unitsErr } = await admin
      .from('units')
      .select('id, unit_code, property, unit_no, zone, zone_code, type, config, rent, bathrooms, furnishing, status, listing_type, alias_code, view_types')
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
        unit_snapshot: {
          alias_code: (units ?? []).find(u => u.id === r.unitId)?.alias_code ?? null,
          ...r.unitSnapshot,
        },
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['superuser','administrator','staff','agent','broker','third_party']);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('inquiry_matches')
    .select('*')
    .eq('inquiry_id', params.id)
    .order('match_tier', { ascending: true })
    .order('match_score', { ascending: false });

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

  const matches = (data ?? []).map(m =>
    isExternal(auth.auth.role) ? scrubMatch(m, auth.auth.role) : m
  );

  return NextResponse.json({ matches });
}
