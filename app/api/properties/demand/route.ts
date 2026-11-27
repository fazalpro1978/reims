import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { buildDemand } from '@/lib/propertyDemand';

export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/properties/demand?limit=25
// Inquiry-to-Inventory demand analysis + portal readiness. Aggregates only — no client or inquiry identifiers.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;
  const limit = Math.min(100, Math.max(5, Number(req.nextUrl.searchParams.get('limit')) || 25));
  try {
    return NextResponse.json(await buildDemand(admin, limit));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Demand analysis failed' }, { status: 500 });
  }
}
