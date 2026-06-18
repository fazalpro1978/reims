import { NextRequest, NextResponse } from 'next/server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const H = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

async function codeExists(code: string): Promise<boolean> {
  const res = await fetch(
    `${SB_URL}/rest/v1/cr_agents?agent_code=eq.${code}&select=agent_code`,
    { headers: H() },
  );
  const d = await res.json();
  return Array.isArray(d) && d.length > 0;
}

async function generateAgentCode(fullName: string): Promise<string> {
  const parts = fullName.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const first  = parts[0]?.[0] ?? 'X';
  const last   = parts[parts.length - 1]?.[0] ?? 'X';
  const second = parts[0]?.[1] ?? 'X';

  const candidates = [
    first + last,
    first + second,
    last  + first,
    ...(parts[0]?.slice(0, 2) ? [parts[0].slice(0, 2)] : []),
  ];

  for (const code of candidates) {
    if (code.length === 2 && !(await codeExists(code))) return code;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 200; i++) {
    const rand = chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)];
    if (!(await codeExists(rand))) return rand;
  }
  throw new Error('Could not generate unique agent code');
}

export async function POST(req: NextRequest) {
  const { fullName, email } = await req.json();
  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Agent full name required' }, { status: 400 });
  }

  let agentCode: string;
  try {
    agentCode = await generateAgentCode(fullName.trim());
  } catch {
    return NextResponse.json({ error: 'Could not generate unique agent code' }, { status: 500 });
  }

  const payload: Record<string, string> = { agent_code: agentCode, full_name: fullName.trim() };
  if (email?.trim()) payload.email = email.trim().toLowerCase();

  const res = await fetch(`${SB_URL}/rest/v1/cr_agents`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json }, { status: 500 });

  const row = Array.isArray(json) ? json[0] : json;
  return NextResponse.json({ agentCode: row.agent_code, fullName: row.full_name, email: row.email ?? null });
}
