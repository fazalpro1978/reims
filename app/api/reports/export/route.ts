import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';
import { resolveColumns } from '@/lib/reportSchema';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return `"${val.join('; ').replace(/"/g, '""')}"`;
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// GET  /api/reports/export          → { count: number }  (preview only)
// POST /api/reports/export          → CSV download
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { count, error } = await admin
    .from('units')
    .select('id', { count: 'exact', head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const body = await req.json() as {
    categories:   string[];
    selectedCols?: Record<string, string[]>;
  };

  const { categories = [], selectedCols } = body;

  if (!categories.length) {
    return NextResponse.json({ error: 'At least one category must be selected' }, { status: 400 });
  }

  const cols = resolveColumns(categories, selectedCols);
  if (!cols.length) {
    return NextResponse.json({ error: 'No columns resolved' }, { status: 400 });
  }

  const dbSelect = cols.map(c => c.dbCol).join(', ');

  const { data, error } = await admin
    .from('units')
    .select(dbSelect)
    .order('property', { ascending: true })
    .order('unit_no',  { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];

  // Build CSV
  const header = cols.map(c => csvCell(c.label)).join(',');
  const body_  = rows.map(row =>
    cols.map(c => csvCell((row as Record<string, unknown>)[c.dbCol])).join(',')
  ).join('\n');

  const now       = new Date();
  const stamp     = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename  = `REIMS-Export-${stamp}.csv`;

  return new NextResponse(`${header}\n${body_}`, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Row-Count':         String(rows.length),
      'X-Generated-At':      now.toISOString(),
    },
  });
}
