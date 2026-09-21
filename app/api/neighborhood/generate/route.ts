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

// ── Overpass QL query ─────────────────────────────────────────────────────────
function buildQuery(lat: number, lon: number): string {
  // Radius in metres per category group
  const r1 = 2000; // lifestyle + parks (walkable)
  const r2 = 5000; // hospitals + metro
  const r3 = 20000; // airport

  const lifestyleTags = [
    `node["shop"~"mall|shopping_centre|supermarket|hypermarket"](around:${r1},${lat},${lon});`,
    `way["shop"~"mall|shopping_centre|supermarket|hypermarket"](around:${r1},${lat},${lon});`,
    `node["amenity"~"school|kindergarten|cinema|theatre|restaurant|fast_food|cafe|community_centre|pharmacy|clinic|doctors|dentist|place_of_worship"](around:${r1},${lat},${lon});`,
    `way["amenity"~"school|kindergarten|cinema|theatre|community_centre|place_of_worship"](around:${r1},${lat},${lon});`,
  ];

  const parksTags = [
    `node["leisure"~"park|garden|playground|sports_centre|pitch|beach_resort|swimming_pool|promenade"](around:${r1},${lat},${lon});`,
    `way["leisure"~"park|garden|playground|sports_centre|pitch|beach_resort|promenade"](around:${r1},${lat},${lon});`,
    `node["natural"="beach"](around:${r1},${lat},${lon});`,
    `way["natural"="beach"](around:${r1},${lat},${lon});`,
  ];

  const commuteTags = [
    `node["amenity"="hospital"](around:${r2},${lat},${lon});`,
    `way["amenity"="hospital"](around:${r2},${lat},${lon});`,
    `node["railway"="station"](around:${r2},${lat},${lon});`,
    `node["station"="subway"](around:${r2},${lat},${lon});`,
    `node["highway"="bus_stop"](around:${r1},${lat},${lon});`,
    `node["amenity"="bus_station"](around:${r1},${lat},${lon});`,
    `node["aeroway"~"aerodrome|terminal"](around:${r3},${lat},${lon});`,
    `way["aeroway"~"aerodrome|terminal"](around:${r3},${lat},${lon});`,
    `node["amenity"="ferry_terminal"](around:${r2},${lat},${lon});`,
  ];

  const lines = [...lifestyleTags, ...parksTags, ...commuteTags];
  return `[out:json][timeout:30];\n(\n  ${lines.join('\n  ')}\n);\nout center tags;`;
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

  let overpassData: { elements: Array<{ id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    overpassData = await res.json();
  } catch (e: unknown) {
    return NextResponse.json({ error: `Overpass fetch failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
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
