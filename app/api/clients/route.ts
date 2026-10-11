import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Client Directory is a live view of inquiries — one row per unique phone number.
// Priority: most recent NON-closed inquiry; if all closed, most recent closed.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const search  = (searchParams.get('search') ?? '').toLowerCase().trim();
    const statusF = searchParams.get('status') ?? '';

    const { data, error } = await admin
      .from('inquiries')
      .select('ref_no, client_name, client_phone, client_email, client_nationality, status, created_at, staff_name, assigned_agent')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[clients GET]', JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    // Deduplicate by phone: keep one row per phone number.
    // For each phone: prefer any non-closed inquiry (already newest-first from ORDER BY).
    // If all are closed, the first (most recent) closed stays.
    const seen = new Map<string, typeof data[number]>();
    for (const row of data ?? []) {
      const key = row.client_phone?.trim() || `__noPhone__${row.ref_no}`;
      if (!seen.has(key)) {
        seen.set(key, row);
      } else {
        const existing = seen.get(key)!;
        // Replace with non-closed if existing is closed
        if (existing.status === 'closed' && row.status !== 'closed') {
          seen.set(key, row);
        }
      }
    }

    let clients = Array.from(seen.values());

    // Search: name, phone, email, ref_no
    if (search) {
      clients = clients.filter(c =>
        c.client_name?.toLowerCase().includes(search) ||
        c.client_phone?.toLowerCase().includes(search) ||
        c.client_email?.toLowerCase().includes(search) ||
        c.ref_no?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusF) {
      clients = clients.filter(c => c.status === statusF);
    }

    return NextResponse.json({ clients, total: clients.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[clients GET] Unexpected:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
