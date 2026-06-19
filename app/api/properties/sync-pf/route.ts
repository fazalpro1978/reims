import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PF_BASE    = 'https://www.propertyfinder.qa';
const BROKER_URL = `${PF_BASE}/en/broker/privegroup-real-estate-v2-1055`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function getMeta(html: string, prop: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
         ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return m?.[1]?.trim() ?? null;
}

function extractListingUrls(html: string): string[] {
  const urls = new Set<string>();

  // Match /en/rent/... and /en/buy/... listing paths
  const re = /href=["'](\/en\/(?:rent|buy)\/[^"'?#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const path = m[1];
    // Filter out broker/search/category pages — real listings have a numeric suffix
    if (/\/[a-z0-9-]+-\d{6,}/.test(path)) {
      urls.add(PF_BASE + path);
    }
  }

  // Also try JSON-LD structured data
  const ldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatch) {
    for (const block of ldMatch) {
      try {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data  = JSON.parse(inner);
        const items = Array.isArray(data) ? data : data['@graph'] ?? [data];
        for (const item of items) {
          if (item.url && typeof item.url === 'string' && item.url.includes('propertyfinder')) {
            urls.add(item.url);
          }
        }
      } catch { /* ignore malformed JSON-LD */ }
    }
  }

  return Array.from(urls);
}

async function fetchListingMeta(url: string): Promise<{
  title: string | null;
  image: string | null;
  description: string | null;
  price: number | null;
  listing_type: 'rent' | 'sale';
  property_type: string | null;
  bedrooms: number | null;
  location: string | null;
}> {
  try {
    const html = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } }).then(r => r.text());

    const title       = getMeta(html, 'og:title');
    const image       = getMeta(html, 'og:image');
    const description = getMeta(html, 'og:description');

    // Derive listing_type from URL
    const listing_type: 'rent' | 'sale' = url.includes('/rent/') ? 'rent' : 'sale';

    // Try to extract price from description or title (e.g. "QAR 7,500/month")
    let price: number | null = null;
    const priceMatch = (description ?? title ?? '').match(/[\d,]+(?:\.\d+)?/g);
    if (priceMatch) {
      const nums = priceMatch.map(s => parseInt(s.replace(/,/g, ''), 10)).filter(n => n > 1000 && n < 100000000);
      if (nums.length > 0) price = nums[0];
    }

    // Property type from title (e.g. "2 Bedroom Apartment for Rent")
    let property_type: string | null = null;
    const typeMatch = (title ?? '').match(/\b(Apartment|Villa|Townhouse|Penthouse|Studio|Duplex|Office|Retail|Warehouse|Land)\b/i);
    if (typeMatch) property_type = typeMatch[1];

    // Bedrooms from title (e.g. "2 Bedroom" or "3 BR")
    let bedrooms: number | null = null;
    const bedMatch = (title ?? '').match(/(\d+)\s*(?:Bedroom|BR|Bed)\b/i);
    if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);

    // Location — last part of title after "in" or "at"
    let location: string | null = null;
    const locMatch = (title ?? '').match(/\b(?:in|at)\s+([^|,\-–]+)/i);
    if (locMatch) location = locMatch[1].trim();

    return { title, image, description, price, listing_type, property_type, bedrooms, location };
  } catch {
    return { title: null, image: null, description: null, price: null, listing_type: 'rent', property_type: null, bedrooms: null, location: null };
  }
}

export async function POST() {
  try {
    // Step 1: Fetch broker page
    const brokerHtml = await fetch(BROKER_URL, { headers: HEADERS, next: { revalidate: 0 } }).then(r => r.text());

    if (!brokerHtml || brokerHtml.length < 500) {
      return NextResponse.json({ error: 'PropertyFinder page returned no content — it may be JavaScript-rendered. Add listings manually.' }, { status: 502 });
    }

    // Step 2: Extract listing URLs
    const urls = extractListingUrls(brokerHtml);

    if (urls.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'No listings found in page source — PropertyFinder renders client-side. Use "Add Listing" to import manually by pasting a PF URL.',
      });
    }

    // Step 3: Fetch meta for each listing (cap at 30 to avoid long waits)
    const capped = urls.slice(0, 30);
    const results = await Promise.allSettled(capped.map(fetchListingMeta));

    const rows = capped.map((url, i) => {
      const meta = results[i].status === 'fulfilled' ? results[i].value : {
        title: null, image: null, description: null, price: null,
        listing_type: 'rent' as const, property_type: null, bedrooms: null, location: null,
      };

      // source_ref = unique slug from URL (last path segment)
      const source_ref = url.split('/').filter(Boolean).pop() ?? url;

      return {
        source:        'propertyfinder',
        source_ref,
        source_url:    url,
        title:         meta.title,
        listing_type:  meta.listing_type,
        property_type: meta.property_type,
        bedrooms:      meta.bedrooms,
        price:         meta.price,
        location:      meta.location,
        description:   meta.description,
        images:        meta.image ? [meta.image] : [],
        status:        'active',
        synced_at:     new Date().toISOString(),
      };
    });

    const { data, error } = await admin
      .from('properties')
      .upsert(rows, { onConflict: 'source,source_ref', ignoreDuplicates: false })
      .select('id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ synced: data?.length ?? 0, total_found: urls.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 });
  }
}
