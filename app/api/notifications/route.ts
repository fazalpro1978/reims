import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';

  let query = admin
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unreadCount = (data ?? []).filter((n: { is_read: boolean }) => !n.is_read).length;
  return NextResponse.json({ notifications: data ?? [], unreadCount });
}

export async function PATCH(req: NextRequest) {
  try {
    const { ids, markAll } = await req.json() as { ids?: string[]; markAll?: boolean };

    if (markAll) {
      await admin.from('notifications').update({ is_read: true }).eq('is_read', false);
    } else if (ids && ids.length > 0) {
      await admin.from('notifications').update({ is_read: true }).in('id', ids);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
