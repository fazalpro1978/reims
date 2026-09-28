import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_LIFESTYLE_SUBCATS = [
  'Shopping Mall', 'Hypermarket / Supermarket', 'International School',
  'Private School', 'Nursery / Preschool', 'Cinema / Entertainment',
  'Restaurant / Dining', 'Mosque', 'Clinic / Medical Centre', 'Community Centre',
];
const VALID_PARKS_SUBCATS = [
  'Family Park', 'Community Park', 'Waterfront / Corniche', 'Walking Track',
  'Cycling Path', 'Sports Facility', 'Public Beach', 'Public Garden', 'Playground',
];
const VALID_COMMUTE_SUBCATS = [
  'Government Hospital', 'Private Hospital', 'Metro Station', 'Bus Stop',
  'Hamad International Airport', 'Highway Access', 'Ferry Terminal',
];

function validateCard(card: Record<string, unknown>, validSubcats: string[]) {
  if (!card || typeof card.name !== 'string' || !card.name.trim()) return null;
  const subcategory = validSubcats.includes(String(card.subcategory ?? ''))
    ? String(card.subcategory)
    : validSubcats[0];
  return {
    id:          crypto.randomUUID(),
    name:        String(card.name).trim(),
    subcategory,
    distance:    typeof card.distance === 'string' ? card.distance : '',
    rating:      typeof card.rating  === 'number'  ? Math.min(5, Math.max(0, card.rating)) : null,
    notes:       typeof card.notes   === 'string'  ? card.notes  : '',
    mapsUrl:     typeof card.mapsUrl === 'string'  ? card.mapsUrl : '',
  };
}

export async function POST(req: NextRequest) {
  // Allow internal service-role calls (from apply route) or authenticated users
  const authHeader = req.headers.get('authorization') ?? '';
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const isInternalCall = authHeader === `Bearer ${svcKey}`;

  // Parse body
  const { zoneCode, zoneName, force = false } = await req.json() as {
    zoneCode: number;
    zoneName: string;
    force?: boolean;
  };

  if (!zoneCode || !zoneName) {
    return NextResponse.json({ error: 'zoneCode and zoneName are required' }, { status: 400 });
  }

  // Skip if zone already has a guide (unless forced)
  if (!force) {
    const { data: existing } = await admin
      .from('unit_neighborhood')
      .select('id')
      .eq('zone_code', zoneCode)
      .eq('is_zone_level', true)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ skipped: true, reason: 'zone_guide_exists' });
    }
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const prompt = `Generate a neighbourhood guide for a residential property listing in this Qatar district.

Zone Code: ${zoneCode}
District Name: ${zoneName}
Country: Qatar

Return ONLY valid JSON (no markdown, no explanation) using this exact schema:
{
  "lifestyle": [{ "name": string, "subcategory": string, "distance": string, "rating": number|null, "notes": string, "mapsUrl": string }],
  "parks":     [{ "name": string, "subcategory": string, "distance": string, "rating": number|null, "notes": string, "mapsUrl": string }],
  "commute":   [{ "name": string, "subcategory": string, "distance": string, "rating": number|null, "notes": string, "mapsUrl": string }]
}

Constraints:
- lifestyle subcategory must be exactly one of: ${VALID_LIFESTYLE_SUBCATS.join(', ')}
- parks subcategory must be exactly one of: ${VALID_PARKS_SUBCATS.join(', ')}
- commute subcategory must be exactly one of: ${VALID_COMMUTE_SUBCATS.join(', ')}
- Distance: estimated walking/driving distance from the centre of ${zoneName}, Qatar (format: "0.8 km" or "350 m")
- Only include real, well-known places that genuinely exist in or near this Qatar district
- Radius: 1.5–2 km for lifestyle and parks; up to 4 km for hospitals; up to 25 km for airport
- rating: realistic 3.5–5.0 for well-known places, null if uncertain
- mapsUrl: leave as empty string "" — do not guess coordinates
- Include 3–8 places per category. If genuinely uncertain, return an empty array []
- Do NOT hallucinate place names. Omit a place if you are not confident it is real and in this district.`;

    const msg = await client.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      thinking:   { type: 'enabled', budget_tokens: 800 },
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = msg.content.find(b => b.type === 'text')?.text ?? '{}';
    const json = JSON.parse(rawText.replace(/```json\n?|\n?```/g, '').trim()) as {
      lifestyle?: unknown[];
      parks?:     unknown[];
      commute?:   unknown[];
    };

    const lifestyle = (json.lifestyle ?? [])
      .map(c => validateCard(c as Record<string, unknown>, VALID_LIFESTYLE_SUBCATS))
      .filter(Boolean);
    const parks = (json.parks ?? [])
      .map(c => validateCard(c as Record<string, unknown>, VALID_PARKS_SUBCATS))
      .filter(Boolean);
    const commute = (json.commute ?? [])
      .map(c => validateCard(c as Record<string, unknown>, VALID_COMMUTE_SUBCATS))
      .filter(Boolean);

    const payload = {
      zone_code:      zoneCode,
      is_zone_level:  true,
      unit_uuid:      null,
      lifestyle_data: lifestyle,
      parks_data:     parks,
      commute_data:   commute,
      last_updated:   new Date().toISOString(),
    };

    // Upsert zone-level guide
    const { data: existing2 } = await admin
      .from('unit_neighborhood')
      .select('id')
      .eq('zone_code', zoneCode)
      .eq('is_zone_level', true)
      .maybeSingle();

    if (existing2) {
      await admin.from('unit_neighborhood').update(payload).eq('id', existing2.id);
    } else {
      await admin.from('unit_neighborhood').insert(payload);
    }

    return NextResponse.json({ ok: true, counts: { lifestyle: lifestyle.length, parks: parks.length, commute: commute.length } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
