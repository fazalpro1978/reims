import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * DELETE /api/inquiries/[id]/comments/[commentId]
 * Author or superuser/administrator only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } },
) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker',
  ]);
  if (!auth.ok) return auth.response;

  const { data: row, error: fetchErr } = await admin
    .from('inquiry_comments')
    .select('author_id')
    .eq('id', params.commentId)
    .eq('inquiry_id', params.id)
    .single();

  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = ['superuser', 'administrator'].includes(auth.auth.role);
  if (!isAdmin && row.author_id !== auth.auth.uid) {
    return NextResponse.json(
      { error: 'Forbidden — can only delete your own comments' },
      { status: 403 },
    );
  }

  const { error } = await admin
    .from('inquiry_comments')
    .delete()
    .eq('id', params.commentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
