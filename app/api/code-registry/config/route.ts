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
    `${SB_URL}/rest/v1/cr_property_type_configs?type_code=eq.${code}&select=type_code`,
    { headers: H() },
  );
  const d = await res.json();
  return Array.isArray(d) && d.length > 0;
}

async function generateTypeCode(
  coreType: string, subType: string, configuration: string,
): Promise<string> {
  const c1 = (coreType.replace(/[^A-Z0-9]/gi, '')[0] ?? 'X').toUpperCase();
  const s1 = (subType.replace(/[^A-Z0-9]/gi, '')[0] ?? 'X').toUpperCase();
  const f1 = (configuration.replace(/[^A-Z0-9]/gi, '')[0] ?? 'X').toUpperCase();
  const f2 = (configuration.replace(/[^A-Z0-9]/gi, '')[1] ?? 'X').toUpperCase();

  const candidates = [c1 + f1, s1 + f1, c1 + f2, s1 + f2, c1 + s1];
  for (const code of candidates) {
    if (code.length === 2 && !(await codeExists(code))) return code;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 200; i++) {
    const rand =
      chars[Math.floor(Math.random() * chars.length)] +
      chars[Math.floor(Math.random() * chars.length)];
    if (!(await codeExists(rand))) return rand;
  }
  throw new Error('Could not generate unique type code');
}

export async function POST(req: NextRequest) {
  const { coreType, subType, configuration, category } = await req.json();

  if (!coreType?.trim() || !subType?.trim() || !configuration?.trim()) {
    return NextResponse.json(
      { error: 'coreType, subType, and configuration are required' },
      { status: 400 },
    );
  }

  // Server-side duplicate guard
  const dupCheck = await fetch(
    `${SB_URL}/rest/v1/cr_property_type_configs?core_type=eq.${encodeURIComponent(coreType.trim())}&sub_type=eq.${encodeURIComponent(subType.trim())}&configuration=eq.${encodeURIComponent(configuration.trim())}&select=type_code`,
    { headers: H() },
  );
  const existing = await dupCheck.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json(
      { error: 'duplicate', message: `"${configuration.trim()}" already exists under ${coreType.trim()} › ${subType.trim()}` },
      { status: 409 },
    );
  }

  let typeCode: string;
  try {
    typeCode = await generateTypeCode(coreType.trim(), subType.trim(), configuration.trim());
  } catch {
    return NextResponse.json({ error: 'Could not generate unique type code' }, { status: 500 });
  }

  const res = await fetch(`${SB_URL}/rest/v1/cr_property_type_configs`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      type_code:            typeCode,
      core_type:            coreType.trim(),
      sub_type:             subType.trim(),
      configuration:        configuration.trim(),
      category:             (category === 'C' || category === 'R') ? category : 'R',
      integration_scenario: '',
      features:             '',
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json }, { status: 500 });

  const row = Array.isArray(json) ? json[0] : json;
  return NextResponse.json(row);
}
