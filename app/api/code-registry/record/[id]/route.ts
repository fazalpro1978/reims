import { NextRequest, NextResponse } from 'next/server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const [recRes, histRes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/cr_registry_full?id=eq.${id}&select=*`, { headers: H() }),
    fetch(
      `${SB_URL}/rest/v1/cr_registry_history?registry_id=eq.${id}&order=changed_at.desc`,
      { headers: H() },
    ),
  ]);

  const record  = await recRes.json();
  const history = await histRes.json();

  return NextResponse.json({
    record:  Array.isArray(record)  ? record[0]  ?? null : null,
    history: Array.isArray(history) ? history : [],
  });
}
