import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const EXTRACT_PROMPT = `You are a real estate inquiry parser for a Qatar property management system. Extract client details and property requirements from the provided text or image.

Return ONLY a valid JSON object — no markdown fences, no prose, no explanation. Use null for fields not found:
{
  "client_name": string | null,
  "client_phone": string | null,
  "client_email": string | null,
  "client_nationality": string | null,
  "listing_type": "Rent" | "Sale" | "Buy" | null,
  "property_type": "Apartment" | "Villa" | "Townhouse" | "Penthouse" | "Studio" | "Duplex" | "Office" | null,
  "config": string | null,
  "bathrooms_min": string | null,
  "budget_min": string | null,
  "budget_max": string | null,
  "preferred_zones": string | null,
  "furnishing": "Fully Furnished" | "Semi-Furnished" | "Unfurnished" | null,
  "move_in_date": string | null,
  "bills_included": "Including" | "Excluding" | "Negotiable" | null,
  "notes": string | null
}

Mapping rules:
- config: bedroom count — normalize to "X BHK" format (e.g. "2 BHK", "3 BHK") or "Studio"
- bathrooms_min: numeric string only (e.g. "2")
- budget_min / budget_max: monthly QAR amount as numeric string, no symbols/commas; if single budget given put in budget_max only
- preferred_zones: comma-separated Qatar location names (e.g. "The Pearl, West Bay, Lusail")
- move_in_date: ISO format YYYY-MM-DD if determinable from text, else null
- bills_included: "Including" if utilities included, "Excluding" if not, "Negotiable" if flexible
- notes: any amenities, special requests, or important context not captured in other fields`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI extraction is not configured. Add ANTHROPIC_API_KEY to your environment.' },
      { status: 503 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    let messageContent: Anthropic.MessageParam['content'];
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('image') as File | null;
      if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = (file.type || 'image/jpeg') as
        | 'image/jpeg'
        | 'image/png'
        | 'image/gif'
        | 'image/webp';

      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: EXTRACT_PROMPT },
      ];
    } else {
      const body = await req.json();
      const text: string = body.text ?? '';
      if (!text.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
      messageContent = [{ type: 'text', text: `${EXTRACT_PROMPT}\n\nText to parse:\n${text}` }];
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: messageContent }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let parsed: Record<string, string | null>;
    try {
      const raw = textBlock.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'AI returned an unparseable response' }, { status: 500 });
    }

    // Return only non-null, non-empty fields
    const extracted: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        extracted[k] = String(v).trim();
      }
    }

    return NextResponse.json({ extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
