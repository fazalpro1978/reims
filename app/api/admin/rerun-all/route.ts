import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runMatchingEngine, UnitRow } from '@/lib/matchingEngine';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TERMINAL = new Set(['won', 'lost', 'cancelled', 'closed']);

export async function POST(req: NextRequest) {
  // Same secret as the escalation cron — set CRON_SECRET in Vercel env vars
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Load all active inquiries (non-terminal)
    const { data: inquiries, error: inqErr } = await admin
      .from('inquiries')
      .select('*')
      .not('status', 'in', `(${Array.from(TERMINAL).join(',')})`);

    if (inqErr) return NextResponse.json({ error: inqErr.message }, { status: 500 });

    // Load all Available units once — reused across every inquiry
    const { data: units, error: unitsErr } = await admin
      .from('units')
      .select('id, unit_code, property, unit_no, zone, zone_code, type, config, rent, bathrooms, furnishing, status, listing_type, smart_code, view_types')
      .eq('status', 'Available');

    if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

    const unitRows = (units ?? []) as UnitRow[];
    const summary: { ref_no: string; matched: number; t1: number; t2: number; t3: number }[] = [];

    for (const inquiry of inquiries ?? []) {
      try {
        const results = runMatchingEngine(inquiry, unitRows);

        // Replace stored matches
        await admin.from('inquiry_matches').delete().eq('inquiry_id', inquiry.id);

        if (results.length > 0) {
          const rows = results.map(r => ({
            inquiry_id:    inquiry.id,
            unit_id:       r.unitId,
            unit_code:     r.unitCode,
            unit_snapshot: {
              smart_code: unitRows.find(u => u.id === r.unitId)?.smart_code ?? null,
              ...r.unitSnapshot,
            },
            match_tier:     r.tier,
            match_score:    r.score,
            match_priority: r.priority,
            match_reasons:  r.reasons,
          }));
          await admin.from('inquiry_matches').insert(rows);
        }

        // Update match metadata
        await admin.from('inquiries').update({
          last_matched_at: new Date().toISOString(),
          match_count:     results.length,
        }).eq('id', inquiry.id);

        summary.push({
          ref_no:  inquiry.ref_no,
          matched: results.length,
          t1:      results.filter(r => r.tier === 1).length,
          t2:      results.filter(r => r.tier === 2).length,
          t3:      results.filter(r => r.tier === 3).length,
        });
      } catch (e) {
        console.error(`[rerun-all] Failed for ${inquiry.ref_no}:`, e);
        summary.push({ ref_no: inquiry.ref_no, matched: -1, t1: 0, t2: 0, t3: 0 });
      }
    }

    console.log(`[rerun-all] Re-scored ${summary.length} inquiries`);
    return NextResponse.json({ rerun: summary.length, results: summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[rerun-all] Unexpected:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
