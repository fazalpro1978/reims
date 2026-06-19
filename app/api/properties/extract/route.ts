import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let messageContent: Anthropic.MessageParam['content'];

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    const text = form.get('text') as string | null;

    if (!file && !text) {
      return NextResponse.json({ error: 'Provide image or text' }, { status: 400 });
    }

    const parts: Anthropic.ContentBlockParam[] = [];

    if (file) {
      const buf = await file.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      parts.push({
        type: 'image',
        source: { type: 'base64', media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: b64 },
      });
    }

    const prompt = `Extract property listing details from ${file ? 'this image' : 'this text'}${text ? (file ? ' and caption: ' + text : ': ' + text) : ''}.

Return a JSON object only — no prose, no markdown fences — with these fields (null if unknown):
{
  "listing_type": "rent" | "sale",
  "property_type": string,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "price": number | null,
  "size_sqm": number | null,
  "location": string | null,
  "zone": string | null,
  "compound": string | null,
  "floor": string | null,
  "furnished": "furnished" | "semi-furnished" | "unfurnished" | null,
  "description": string | null,
  "title": string | null
}`;

    parts.push({ type: 'text', text: prompt });
    messageContent = parts;
  } else {
    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    messageContent = `Extract property listing details from this social media post/caption.

Return a JSON object only — no prose, no markdown fences — with these fields (null if unknown):
{
  "listing_type": "rent" | "sale",
  "property_type": string,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "price": number | null,
  "size_sqm": number | null,
  "location": string | null,
  "zone": string | null,
  "compound": string | null,
  "floor": string | null,
  "furnished": "furnished" | "semi-furnished" | "unfurnished" | null,
  "description": string | null,
  "title": string | null
}

Post/caption:
${text}`;
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: messageContent }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'No response from Claude' }, { status: 500 });
  }

  try {
    const raw = textBlock.text.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
    const extracted = JSON.parse(raw);
    // Strip null values
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extracted)) {
      if (v !== null && v !== undefined && v !== '') clean[k] = v;
    }
    return NextResponse.json({ extracted: clean });
  } catch {
    return NextResponse.json({ error: 'Could not parse extracted data', raw: textBlock.text }, { status: 500 });
  }
}
