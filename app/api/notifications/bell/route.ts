import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

function adminClient(schema = 'public') {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    schema !== 'public' ? { db: { schema } } : undefined,
  );
}

export type BellItemType =
  | 'pipeline_done'
  | 'pipeline_failed'
  | 'pipeline_killed'
  | 'expiry_critical'
  | 'expiry_soon'
  | 'card_assigned'
  | 'registration_pending';

export interface BellItem {
  id:         string;
  type:       BellItemType;
  title:      string;
  body:       string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const sb     = adminClient();
  const ingest = adminClient('ingest');
  const now    = new Date();
  const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // Fire all queries in parallel
  const [
    { data: batches },
    { data: assignments },
    { data: units },
  ] = await Promise.all([
    ingest
      .from('batch_logs')
      .select('batch_id, file_name, phase, done_at, total_rows, error_rows')
      .in('phase', ['done', 'failed', 'killed'])
      .gte('done_at', ago48h)
      .order('done_at', { ascending: false })
      .limit(20),
    sb
      .from('notifications')
      .select('id, title, body, created_at, inquiry_id')
      .eq('type', 'card_assigned')
      .eq('target_user_email', auth.auth.email)
      .gte('created_at', ago48h)
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('units')
      .select('unit_code, contract_end_date')
      .eq('status', 'Leased')
      .not('contract_end_date', 'is', null),
  ]);

  const items: BellItem[] = [];

  // Pending registration requests (superuser/admin only, no time limit)
  if (['superuser', 'administrator'].includes(auth.auth.role)) {
    const { data: pendingRegs } = await sb
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('registration_status', 'pending')
      .order('created_at', { ascending: true });

    if (pendingRegs && pendingRegs.length > 0) {
      const names = pendingRegs.slice(0, 2).map((r: { full_name: string | null; email: string }) => r.full_name ?? r.email.split('@')[0]);
      const label = names.join(', ') + (pendingRegs.length > 2 ? ` +${pendingRegs.length - 2} more` : '');
      items.push({
        id:         'registration_pending',
        type:       'registration_pending',
        title:      `${pendingRegs.length} access request${pendingRegs.length !== 1 ? 's' : ''} pending`,
        body:       label,
        created_at: pendingRegs[0].created_at ?? now.toISOString(),
      });
    }
  }

  const expiring7:  string[] = [];
  const expiring30: string[] = [];
  for (const u of units ?? []) {
    const days = (new Date(u.contract_end_date).getTime() - now.getTime()) / 86400000;
    if (days >= 0 && days <= 7)       expiring7.push(u.unit_code);
    else if (days > 7 && days <= 30)  expiring30.push(u.unit_code);
  }

  for (const b of batches ?? []) {
    const name = b.file_name ? b.file_name.replace(/\.[^.]+$/, '') : 'Batch';
    const type: BellItemType =
      b.phase === 'done'   ? 'pipeline_done'   :
      b.phase === 'failed' ? 'pipeline_failed'  : 'pipeline_killed';
    items.push({
      id:    b.batch_id,
      type,
      title: b.phase === 'done'
        ? `Import complete — ${b.total_rows ?? 0} records`
        : b.phase === 'failed' ? 'Import failed' : 'Import cancelled',
      body:       name + (b.error_rows ? ` · ${b.error_rows} error${b.error_rows !== 1 ? 's' : ''}` : ''),
      created_at: b.done_at ?? now.toISOString(),
    });
  }

  if (expiring7.length > 0) {
    items.push({
      id:    'expiry_critical',
      type:  'expiry_critical',
      title: `${expiring7.length} lease${expiring7.length !== 1 ? 's' : ''} expiring within 7 days`,
      body:  expiring7.slice(0, 3).join(', ') + (expiring7.length > 3 ? ` +${expiring7.length - 3} more` : ''),
      created_at: now.toISOString(),
    });
  }

  if (expiring30.length > 0) {
    items.push({
      id:    'expiry_soon',
      type:  'expiry_soon',
      title: `${expiring30.length} lease${expiring30.length !== 1 ? 's' : ''} expiring within 30 days`,
      body:  expiring30.slice(0, 3).join(', ') + (expiring30.length > 3 ? ` +${expiring30.length - 3} more` : ''),
      created_at: now.toISOString(),
    });
  }

  for (const a of assignments ?? []) {
    items.push({
      id:         a.id,
      type:       'card_assigned',
      title:      a.title ?? 'Inquiry assigned to you',
      body:       a.body ?? '',
      created_at: a.created_at,
    });
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ items });
}
