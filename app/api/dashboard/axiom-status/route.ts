import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function ingestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'ingest' } },
  );
}

const ROLE_RANK: Record<string, number> = {
  superuser: 4, administrator: 3, staff: 2, agent: 1, public: 0,
};

async function assertStaff(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const sb = adminClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await sb.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (!p?.is_active) return null;
  if ((ROLE_RANK[p.role] ?? -1) < ROLE_RANK.staff) return null;
  return { uid: user.id, role: p.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await assertStaff(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ic = ingestClient();

  const [runsResult, pendingResult] = await Promise.all([
    ic.from('upload_runs')
      .select('id, source_file, status, record_count, approved_count, exported_count, uploaded_at, uploaded_by')
      .order('uploaded_at', { ascending: false })
      .limit(5),
    ic.from('vetted_records')
      .select('id', { count: 'exact', head: true })
      .is('exported_at', null),
  ]);

  return NextResponse.json({
    recentRuns:   runsResult.data  ?? [],
    pendingExport: pendingResult.count ?? 0,
  });
}
