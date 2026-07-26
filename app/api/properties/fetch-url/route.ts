import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/serverAuth';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Allow only public real estate listing sites — prevents SSRF to internal networks
const ALLOWED_HOSTS = new Set([
  'www.propertyfinder.com.qa',
  'propertyfinder.com.qa',
  'www.bayut.qa',
  'bayut.qa',
  'www.propertyoryx.com',
  'propertyoryx.com',
  'www.hatla2ee.com',
  'hatla2ee.com',
]);

function getMeta(html: string, prop: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
         ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return m?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  // SSRF guard — validate URL and restrict to known listing domains
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json(
      { error: `Domain not allowed. Supported: propertyfinder.com.qa, bayut.qa, propertyoryx.com, hatla2ee.com` },
      { status: 400 }
    );
  }

  try {
    const html = await fetch(parsed.toString(), { headers: HEADERS, next: { revalidate: 0 } }).then(r => r.text());

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
      source_url: parsed.toString(),
      source_ref: parsed.pathname.split('/').filter(Boolean).pop() ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 });
  }
}
