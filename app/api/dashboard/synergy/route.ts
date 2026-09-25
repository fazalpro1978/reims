import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const TERMINAL = ['won', 'lost', 'cancelled', 'closed'];
const STAGES   = ['new', 'contacted', 'viewing', 'negotiating', 'won', 'lost', 'cancelled', 'closed'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: rows, error } = await sb
    .from('inquiries')
    .select('status, match_count, created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = rows ?? [];
  const total = all.length;

  const byStatus = Object.fromEntries(
    STAGES.map(s => [s, all.filter(r => r.status === s).length])
  ) as Record<string, number>;

  const active     = all.filter(r => !TERMINAL.includes(r.status)).length;
  const hot        = (byStatus.viewing ?? 0) + (byStatus.negotiating ?? 0);
  const won        = byStatus.won  ?? 0;
  const lost       = byStatus.lost ?? 0;
  const decided    = won + lost;
  const conversion = decided > 0 ? Math.round((won / decided) * 100) : null;
  const totalMatches = all.reduce((s, r) => s + (r.match_count ?? 0), 0);
  const avgMatches = total > 0 ? Math.round(totalMatches / total) : 0;

  // Inquiries opened in the last 7 and 30 days
  const now    = Date.now();
  const day7   = new Date(now - 7  * 86_400_000).toISOString();
  const day30  = new Date(now - 30 * 86_400_000).toISOString();
  const new7d  = all.filter(r => r.created_at >= day7).length;
  const new30d = all.filter(r => r.created_at >= day30).length;

  return NextResponse.json({
    total, active, hot, won, lost, conversion, avgMatches, new7d, new30d, byStatus,
  });
}
