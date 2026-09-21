import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

// ── Haversine distance (metres) ───────────────────────────────────────────────
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// ── OSM element → readable name (English preferred) ──────────────────────────
function getName(tags: Record<string, string>): string {
  return (tags['name:en'] || tags['name'] || '').trim();
}

// ── Category mapping ──────────────────────────────────────────────────────────
type Pillar = 'lifestyle' | 'parks' | 'commute';

interface Place {
  id:          string;
  name:        string;
  subcategory: string;
  distance:    string;
  rating:      null;
  notes:       string;
  mapsUrl:     string;
  _lat:        number;
  _lon:        number;
}

function classifyLifestyle(tags: Record<string, string>): string | null {
  const shop    = tags['shop']    ?? '';
  const amenity = tags['amenity'] ?? '';
  const leisure = tags['leisure'] ?? '';
  const name    = (tags['name'] ?? '').toLowerCase();

  if (shop === 'mall' || shop === 'shopping_centre') return 'Shopping Mall';
  if (shop === 'supermarket' || shop === 'hypermarket') return 'Hypermarket / Supermarket';
  if (amenity === 'kindergarten') return 'Nursery / Preschool';
  if (amenity === 'school') {
    if (name.includes('international') || tags['school:type'] === 'international' || tags['operator:type'] === 'international') return 'International School';
    return 'Private School';
  }
  if (amenity === 'cinema' || amenity === 'theatre' || amenity === 'arts_centre' || leisure === 'amusement_arcade') return 'Cinema / Entertainment';
  if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'cafe' || amenity === 'food_court') return 'Restaurant / Dining';
  if (amenity === 'place_of_worship' && (tags['religion'] === 'muslim' || tags['religion'] === 'islam')) return 'Mosque';
  if (amenity === 'clinic' || amenity === 'doctors' || amenity === 'dentist' || amenity === 'pharmacy') return 'Clinic / Medical Centre';
  if (amenity === 'community_centre' || amenity === 'social_facility') return 'Community Centre';
  return null;
}

function classifyParks(tags: Record<string, string>): string | null {
  const leisure = tags['leisure'] ?? '';
  const natural = tags['natural'] ?? '';
  const highway = tags['highway'] ?? '';

  if (natural === 'beach' || leisure === 'beach_resort') return 'Public Beach';
  if (leisure === 'garden') return 'Public Garden';
  if (leisure === 'playground') return 'Playground';
  if (leisure === 'sports_centre' || leisure === 'stadium' || leisure === 'pitch') return 'Sports Facility';
  if (leisure === 'swimming_pool') return 'Sports Facility';
  if (leisure === 'promenade' || tags['waterfront'] === 'yes') return 'Waterfront / Corniche';
  if (leisure === 'park') return 'Family Park';
  if (highway === 'cycleway') return 'Cycling Path';
  if (highway === 'footway' || highway === 'path') return 'Walking Track';
  return null;
}

function classifyCommute(tags: Record<string, string>): string | null {
  const amenity   = tags['amenity']         ?? '';
  const railway   = tags['railway']         ?? '';
  const station   = tags['station']         ?? '';
  const highway   = tags['highway']         ?? '';
  const aeroway   = tags['aeroway']         ?? '';
  const network   = (tags['network'] ?? '').toLowerCase();
  const name      = (tags['name']    ?? '').toLowerCase();

  if (aeroway === 'aerodrome' || aeroway === 'terminal' || name.includes('airport') || name.includes('hamad international')) return 'Hamad International Airport';
  if (amenity === 'hospital') {
    const opType = (tags['operator:type'] ?? tags['healthcare:speciality'] ?? '').toLowerCase();
    return opType === 'public' || opType === 'government' ? 'Government Hospital' : 'Private Hospital';
  }
  if (amenity === 'ferry_terminal') return 'Ferry Terminal';
  if (railway === 'station' || station === 'subway' || network.includes('metro') || name.includes('metro') || name.includes('station')) return 'Metro Station';
  if (highway === 'bus_stop' || amenity === 'bus_station') return 'Bus Stop';
  if (highway === 'motorway_junction' || highway === 'trunk_link') return 'Highway Access';
  return null;
}

// ── Overpass QL query — compact (uses nwr to merge node/way/relation) ─────────
function buildQuery(lat: number, lon: number): string {
  // nwr = node + way + relation in one filter; keeps query count low to avoid 429
  return `[out:json][timeout:25];
(
  nwr["shop"~"^(mall|shopping_centre|supermarket|hypermarket)$"](around:3000,${lat},${lon});
  nwr["amenity"~"^(school|kindergarten|cinema|theatre|restaurant|fast_food|place_of_worship|clinic|doctors|pharmacy|community_centre)$"](around:2500,${lat},${lon});
  nwr["leisure"~"^(park|garden|playground|sports_centre|pitch|beach_resort|promenade)$"](around:2500,${lat},${lon});
  nwr["natural"="beach"](around:2500,${lat},${lon});
  nwr["amenity"~"^(hospital|bus_station|ferry_terminal)$"](around:5000,${lat},${lon});
  nwr["railway"="station"](around:5000,${lat},${lon});
  nwr["highway"="bus_stop"](around:1500,${lat},${lon});
  nwr["aeroway"~"^(aerodrome|terminal)$"](around:25000,${lat},${lon});
);
out center tags;`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const query = buildQuery(lat, lon);

  type OverpassEl = { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
  type OverpassResp = { elements: OverpassEl[] };

  // Three Overpass mirrors; use GET with explicit Accept to avoid Next.js
  // injecting headers that cause 406. Brief delay between retries so a
  // rate-limited primary doesn't immediately saturate the mirror.
  const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  const encodedQuery = encodeURIComponent(query);
  let overpassData: OverpassResp = { elements: [] };
  let lastErr = '';

  for (let i = 0; i < ENDPOINTS.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800));
    const endpoint = ENDPOINTS[i];
    try {
      const res = await fetch(`${endpoint}?data=${encodedQuery}`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'REIMS/1.0 (realestate)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { lastErr = `HTTP ${res.status} from ${endpoint}`; continue; }
      overpassData = await res.json();
      lastErr = '';
      break;
    } catch (e: unknown) {
      lastErr = `${endpoint}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (lastErr) {
    return NextResponse.json({ error: `Overpass unavailable (all mirrors): ${lastErr}` }, { status: 502 });
  }

  const elements = overpassData.elements ?? [];
  const lifestyle: Place[] = [];
  const parks:     Place[] = [];
  const commute:   Place[] = [];
  const seenNames = new Set<string>();

  for (const el of elements) {
    const tags   = el.tags ?? {};
    const name   = getName(tags);
    if (!name) continue;

    // Deduplicate by name (ways + nodes for same place)
    const key = name.toLowerCase().replace(/\s+/g, '');
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const elLat = el.center?.lat ?? el.lat ?? 0;
    const elLon = el.center?.lon ?? el.lon ?? 0;
    const dist  = distM(lat, lon, elLat, elLon);
    const googleMapsUrl = elLat && elLon ? `https://www.google.com/maps?q=${elLat},${elLon}` : '';

    const base: Place = {
      id:          `osm-${el.type}-${el.id}`,
      name,
      subcategory: '',
      distance:    fmtDist(dist),
      rating:      null,
      notes:       '',
      mapsUrl:     googleMapsUrl,
      _lat:        elLat,
      _lon:        elLon,
    };

    const lsCat = classifyLifestyle(tags);
    if (lsCat) { lifestyle.push({ ...base, subcategory: lsCat }); continue; }

    const pkCat = classifyParks(tags);
    if (pkCat) { parks.push({ ...base, subcategory: pkCat }); continue; }

    const cmCat = classifyCommute(tags);
    if (cmCat) { commute.push({ ...base, subcategory: cmCat }); }
  }

  // Sort each pillar by distance, cap at 15 per pillar
  const byDist = (a: Place, b: Place) => distM(lat, lon, a._lat, a._lon) - distM(lat, lon, b._lat, b._lon);
  const clean  = (arr: Place[]) =>
    arr.sort(byDist).slice(0, 15).map(({ _lat: _l, _lon: _n, ...rest }) => rest);

  return NextResponse.json({
    lifestyle: clean(lifestyle),
    parks:     clean(parks),
    commute:   clean(commute),
    count:     lifestyle.length + parks.length + commute.length,
  });
}
