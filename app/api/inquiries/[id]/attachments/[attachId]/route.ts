import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * DELETE /api/inquiries/[id]/attachments/[attachId]
 * Removes the file from Storage and deletes the DB row.
 * Only the uploader or superuser/administrator may delete.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; attachId: string } },
) {
  const auth = await requireAuth(req, [
    'superuser', 'administrator', 'staff', 'agent', 'broker',
  ]);
  if (!auth.ok) return auth.response;

  const { data: row, error: fetchErr } = await admin
    .from('inquiry_attachments')
    .select('uploaded_by, storage_path')
    .eq('id', params.attachId)
    .eq('inquiry_id', params.id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isAdmin = ['superuser', 'administrator'].includes(auth.auth.role);
  if (!isAdmin && row.uploaded_by !== auth.auth.uid) {
    return NextResponse.json(
      { error: 'Forbidden — can only delete your own attachments' },
      { status: 403 },
    );
  }

  await admin.storage.from('inquiry-attachments').remove([row.storage_path]);

  const { error: dbErr } = await admin
    .from('inquiry_attachments')
    .delete()
    .eq('id', params.attachId);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
