import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PF_BROKER_URL = 'https://www.propertyfinder.qa/en/broker/privegroup-real-estate-v2-1055';

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  try {
    // Fetch the PropertyFinder broker page
    const html = await fetch(PF_BROKER_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 0 },
    }).then(r => r.text());

    if (!html || html.length < 500) {
      return NextResponse.json({ error: 'PropertyFinder page returned no content' }, { status: 502 });
    }

    // Truncate to 80k chars to stay within Claude context
    const truncated = html.slice(0, 80000);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      messages: [{
        role: 'user',
        content: `Extract ALL property listings from this PropertyFinder broker page HTML. Return a JSON array only — no prose, no markdown fences.

Each listing object must have these fields (null if not found):
- source_ref: string — the unique listing identifier from the URL (e.g. "QR5734352")
- source_url: string — full URL to the listing page
- title: string
- listing_type: "rent" | "sale"
- property_type: string (Apartment, Villa, Townhouse, Penthouse, Studio, etc.)
- bedrooms: number | null (null for studio/commercial)
- bathrooms: number | null
- price: number (monthly if rent, total if sale)
- size_sqm: number | null
- location: string | null
- zone: string | null
- compound: string | null
- furnished: "furnished" | "semi-furnished" | "unfurnished" | null
- description: string | null
- images: string[] (array of image URLs found)

HTML:
${truncated}`,
      }],
    });

    const textBlock = msg.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No text response from Claude' }, { status: 500 });
    }

    let listings: Record<string, unknown>[];
    try {
      const raw = textBlock.text.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      listings = JSON.parse(raw);
      if (!Array.isArray(listings)) throw new Error('Not an array');
    } catch {
      return NextResponse.json({ error: 'Claude response was not valid JSON', raw: textBlock.text.slice(0, 500) }, { status: 500 });
    }

    if (listings.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No listings found — PropertyFinder may be JavaScript-rendered. Use manual entry.' });
    }

    // Upsert all listings — on conflict (source + source_ref) update fields
    const rows = listings.map(l => ({
      source:       'propertyfinder',
      source_ref:   l.source_ref   ?? null,
      source_url:   l.source_url   ?? null,
      title:        l.title        ?? null,
      listing_type: l.listing_type === 'sale' ? 'sale' : 'rent',
      property_type: l.property_type ?? null,
      bedrooms:     l.bedrooms != null ? Number(l.bedrooms) : null,
      bathrooms:    l.bathrooms != null ? Number(l.bathrooms) : null,
      price:        l.price != null ? Number(l.price) : null,
      size_sqm:     l.size_sqm != null ? Number(l.size_sqm) : null,
      location:     l.location  ?? null,
      zone:         l.zone      ?? null,
      compound:     l.compound  ?? null,
      furnished:    l.furnished ?? null,
      description:  l.description ?? null,
      images:       Array.isArray(l.images) ? l.images : [],
      status:       'active',
      synced_at:    new Date().toISOString(),
    }));

    const { data, error } = await admin
      .from('properties')
      .upsert(rows, { onConflict: 'source,source_ref', ignoreDuplicates: false })
      .select('id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ synced: data?.length ?? 0, total_found: listings.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 });
  }
}
