import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, type Role } from '@/lib/serverAuth';

const VALID_GROUPS: Role[] = ['staff', 'agent', 'broker', 'third_party', 'public'];

function makeAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { params: { eventsPerSecond: -1 } }, global: { fetch } },
  );
}

// POST — compose and dispatch a broadcast
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['superuser', 'administrator']);
    if (!auth.ok) return auth.response;

    let parsed: { title?: string; body?: string; target_groups?: string[] };
    try { parsed = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { title, body: msgBody, target_groups } = parsed;

    if (!title?.trim() || title.trim().length > 160)
      return NextResponse.json({ error: 'title is required (max 160 chars)' }, { status: 400 });
    if (!msgBody?.trim() || msgBody.trim().length > 2000)
      return NextResponse.json({ error: 'body is required (max 2000 chars)' }, { status: 400 });
    if (!Array.isArray(target_groups) || target_groups.length === 0)
      return NextResponse.json({ error: 'target_groups must be a non-empty array' }, { status: 400 });

    const sanitisedGroups = target_groups.filter(g => VALID_GROUPS.includes(g as Role));
    if (sanitisedGroups.length === 0)
      return NextResponse.json({ error: `target_groups must include one of: ${VALID_GROUPS.join(', ')}` }, { status: 400 });

    const admin = makeAdmin();

    // Resolve target users
    const { data: recipients, error: recipErr } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .in('role', sanitisedGroups)
      .eq('is_active', true);

    if (recipErr)
      return NextResponse.json({ error: 'Database error resolving recipients', detail: recipErr.message }, { status: 500 });

    const deliveryCount = (recipients ?? []).length;

    // Insert immutable audit record
    const { data: broadcast, error: bcErr } = await admin
      .from('broadcasts')
      .insert({
        sender_id:      auth.auth.uid,
        sender_name:    auth.auth.fullName,
        sender_email:   auth.auth.email,
        title:          title.trim(),
        body:           msgBody.trim(),
        target_groups:  sanitisedGroups,
        delivery_count: deliveryCount,
      })
      .select()
      .single();

    if (bcErr || !broadcast)
      return NextResponse.json({
        error:  'Failed to create broadcast',
        detail: bcErr ? `${bcErr.message} (code: ${bcErr.code})` : 'no data returned',
      }, { status: 500 });

    // Fan-out: one notifications row per recipient
    if (deliveryCount > 0) {
      const rows = (recipients ?? []).map(r => ({
        type:              'broadcast',
        title:             title.trim(),
        body:              msgBody.trim(),
        target_user_email: r.email,
        broadcast_id:      broadcast.id,
        is_read:           false,
      }));

      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: fanErr } = await admin.from('notifications').insert(rows.slice(i, i + CHUNK));
        if (fanErr) console.error('broadcast fan-out error:', fanErr.message);
      }
    }

    return NextResponse.json({ broadcast, delivery_count: deliveryCount }, { status: 201 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('broadcasts POST unhandled:', msg);
    return NextResponse.json({ error: 'Unexpected server error', detail: msg }, { status: 500 });
  }
}

// GET — audit log (admin only)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['superuser', 'administrator']);
    if (!auth.ok) return auth.response;

    const admin = makeAdmin();
    const { data, error } = await admin
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 });
    return NextResponse.json({ broadcasts: data ?? [] });

  } catch (err) {
    return NextResponse.json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
