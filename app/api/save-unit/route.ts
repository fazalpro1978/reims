import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS; never sent to the browser
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { unitUuid, fields } = await req.json() as {
      unitUuid: string;
      fields: Record<string, unknown>;
    };

    if (!unitUuid || typeof unitUuid !== 'string') {
      return NextResponse.json({ error: 'unitUuid is required' }, { status: 400 });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields object is required' }, { status: 400 });
    }

    const { error } = await admin.from('units').update(fields).eq('id', unitUuid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 }
    );
  }
}
