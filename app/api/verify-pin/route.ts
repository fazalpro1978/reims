import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['staff', 'administrator', 'superuser']);
  if (!auth.ok) return auth.response;

  const { pin } = await req.json().catch(() => ({ pin: '' }));
  const adminPin = process.env.ADMIN_PIN;

  if (!adminPin) {
    return NextResponse.json({ error: 'PIN not configured' }, { status: 500 });
  }

  if (pin !== adminPin) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
