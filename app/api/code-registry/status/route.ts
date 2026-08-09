import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = (extra?: Record<string, string>) => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
  ...extra,
});

const VALID = new Set(['Active', 'Closed', 'Cancelled', 'Archived']);

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;
  const { id, smartCode, fromStatus, toStatus, changedBy, notes } = await req.json();

  if (!id || !smartCode || !toStatus) {
    return NextResponse.json({ error: 'id, smartCode and toStatus are required' }, { status: 400 });
  }
  if (!VALID.has(toStatus)) {
    return NextResponse.json({ error: `Invalid status: ${toStatus}` }, { status: 400 });
  }

  // Update status on cr_registry
  const upd = await fetch(`${SB_URL}/rest/v1/cr_registry?id=eq.${id}`, {
    method: 'PATCH',
    headers: H(),
    body: JSON.stringify({ status: toStatus }),
  });
  if (!upd.ok) {
    const e = await upd.json();
    return NextResponse.json({ error: e }, { status: 500 });
  }

  // Append history row
  const hist = await fetch(`${SB_URL}/rest/v1/cr_registry_history`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      registry_id: id,
      smart_code:  smartCode,
      from_status: fromStatus ?? null,
      to_status:   toStatus,
      changed_by:  changedBy ?? 'Administrator',
      notes:       notes ?? null,
    }),
  });
  const histJson = await hist.json();
  const entry = Array.isArray(histJson) ? histJson[0] : histJson;

  return NextResponse.json({ status: toStatus, historyEntry: entry });
}
