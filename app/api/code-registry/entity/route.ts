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
    `${SB_URL}/rest/v1/cr_entity_codes?entity_code=eq.${code}&select=entity_code`,
    { headers: H() },
  );
  const d = await res.json();
  return Array.isArray(d) && d.length > 0;
}

async function generateCode(name: string): Promise<string> {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(3, '0');
  const candidates = [
    base.slice(0, 3),
    base[0] + base.slice(2, 4),
    base[0] + base[Math.floor(base.length / 2)] + base[base.length - 1],
  ];
  for (const c of candidates) {
    const code = c.slice(0, 3).padEnd(3, '0');
    if (!(await codeExists(code))) return code;
  }
  // Fallback: random alphanumeric until unique
  for (let i = 0; i < 100; i++) {
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    if (!(await codeExists(rand))) return rand;
  }
  throw new Error('Could not generate unique entity code');
}

export async function POST(req: NextRequest) {
  const { companyName, classification } = await req.json();
  if (!companyName?.trim()) {
    return NextResponse.json({ error: 'Company name required' }, { status: 400 });
  }

  const entityCode = await generateCode(companyName.trim());

  const res = await fetch(`${SB_URL}/rest/v1/cr_entity_codes`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      entity_code:    entityCode,
      company_name:   companyName.trim(),
      classification: classification || 'Independent',
      is_manual:      true,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json }, { status: 500 });

  const row = Array.isArray(json) ? json[0] : json;
  return NextResponse.json({ entityCode: row.entity_code, companyName: row.company_name });
}
