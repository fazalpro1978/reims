import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

function getMeta(html: string, prop: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
         ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return m?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  try {
    const html = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } }).then(r => r.text());

    const title       = getMeta(html, 'og:title');
    const image       = getMeta(html, 'og:image');
    const description = getMeta(html, 'og:description');

    const listing_type: 'rent' | 'sale' = url.includes('/rent/') ? 'rent' : 'sale';

    let price: number | null = null;
    const priceMatch = (description ?? title ?? '').match(/[\d,]+/g);
    if (priceMatch) {
      const nums = priceMatch.map((s: string) => parseInt(s.replace(/,/g, ''), 10)).filter((n: number) => n > 1000 && n < 100000000);
      if (nums.length > 0) price = nums[0];
    }

    let property_type: string | null = null;
    const typeMatch = (title ?? '').match(/\b(Apartment|Villa|Townhouse|Penthouse|Studio|Duplex|Office|Retail|Warehouse|Land)\b/i);
    if (typeMatch) property_type = typeMatch[1];

    let bedrooms: number | null = null;
    const bedMatch = (title ?? '').match(/(\d+)\s*(?:Bedroom|BR|Bed)\b/i);
    if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);

    let location: string | null = null;
    const locMatch = (title ?? '').match(/\b(?:in|at)\s+([^|,\-–]+)/i);
    if (locMatch) location = locMatch[1].trim();

    return NextResponse.json({
      title, image, description, price, listing_type,
      property_type, bedrooms, location,
      source_url: url,
      source_ref: url.split('/').filter(Boolean).pop() ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch URL' }, { status: 500 });
  }
}
