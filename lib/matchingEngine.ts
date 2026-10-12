// ─────────────────────────────────────────────────────────────────────────────
// Inquiry Matching Engine — Weighted scoring + strict tie-breaking
//
// PRIMARY CRITERIA (80 pts)
//   Config         30 — bedroom / layout configuration
//   Budget Min     20 — rent satisfies client's floor
//   Zone           20 — preferred zone match
//   Property Type  10 — apartment / villa / etc.
//
// SECONDARY CRITERIA (20 pts)
//   Bathrooms       8 — meets minimum bathroom count
//   Furnishing      7 — furnishing preference
//   Budget Fit      5 — rent within stated ceiling
//
// Neutral scoring: when a preference was not specified, the field contributes
// half its weight. This keeps the baseline near ~50 and ensures specified-but-
// mismatched fields visibly drag the score down.
//
// Tie-breaking: when two records share the same rounded score%, a numeric
// priority key breaks the tie using the weighted field order above, with
// exact matches on Config and Budget Min taking highest precedence.
// ─────────────────────────────────────────────────────────────────────────────

export interface InquiryPayload {
  budget_min?: number | null;
  budget_max?: number | null;
  property_type?: string | null;
  listing_type?: string | null;
  config?: string | null;
  bathrooms_min?: number | null;
  preferred_zones?: string[] | null;
  furnishing?: string | null;
}

export interface UnitRow {
  id: string;
  unit_code: string;
  property: string;
  unit_no: string;
  zone: string;
  zone_code: number;
  type: string;
  config: string;
  rent: number;
  bathrooms: number;
  furnishing: string;
  status: string;
  listing_type: string;
  view_types?: string[];
}

export interface MatchReasons {
  budget:     'exact' | 'flex' | false;
  budget_fit: 'within' | 'over' | null;
  type:       boolean | null;
  config:     'exact' | 'partial' | false | null;
  bathrooms:  boolean | null;
  zone:       'exact' | 'adjacent' | false | null;
  furnishing: boolean | null;
}

export interface MatchResult {
  unitId:       string;
  unitCode:     string;
  unitSnapshot: Record<string, unknown>;
  tier:         1 | 2 | 3;
  score:        number;
  priority:     number; // tie-break key — higher wins
  reasons:      MatchReasons;
}

// ── Field weights (must sum to 100) ──────────────────────────────────────────
const W_CONFIG      = 30;
const W_BUDGET_MIN  = 20;
const W_ZONE        = 20;
const W_TYPE        = 10;
const W_BATHROOMS   =  8;
const W_FURNISHING  =  7;
const W_BUDGET_FIT  =  5;

// Tier score thresholds
const TIER1_SCORE = 75;
const TIER2_SCORE = 45;

// ── Zone adjacency map ────────────────────────────────────────────────────────
// Keys and values are district_name strings from cr_zone_codes, lowercased.
// Qatar zone codes are non-sequential per municipality — numeric proximity is
// meaningless. Both directions must be listed (if A lists B, B must list A).
// Some district_name values appear in multiple zone_codes (e.g. "Musheireb"
// is zones 4 and 13) — the same key covers all of them.
const ZONE_ADJACENCY: Record<string, string[]> = {

  // ── West Bay / Al Dafna cluster (zones 60, 61) ───────────────────────────
  'al dafna': [
    'al dafna / al qassar',
    'onaiza',
    'as salatah / al mirqab',
    'pearl / leqtaifiya / al qassar',
  ],
  'al dafna / al qassar': [
    'al dafna',
    'onaiza',
    'pearl / leqtaifiya / al qassar',
    'as salatah / al mirqab',
    'lejbailat',
  ],
  'onaiza': [                         // zones 63, 65
    'al dafna',
    'al dafna / al qassar',
    'lejbailat',
    'pearl / leqtaifiya / al qassar',
    'hazm al markhiya',
  ],
  'lejbailat': [                      // zone 64
    'onaiza',
    'al dafna / al qassar',
    'pearl / leqtaifiya / al qassar',
  ],
  'as salatah / al mirqab': [         // zone 18
    'al dafna',
    'al dafna / al qassar',
    'musheireb',
    'fereej mohamed bin jassim / musheireb',
    'al najada / barahat al jufairi',
  ],

  // ── The Pearl (zone 66) ───────────────────────────────────────────────────
  'pearl / leqtaifiya / al qassar': [
    'al dafna / al qassar',
    'al dafna',
    'onaiza',
    'lejbailat',
    'lusail / al kharayej / wadi al banat',
  ],

  // ── Lusail cluster (zones 69, 70) ────────────────────────────────────────
  'lusail / al kharayej / wadi al banat': [
    'al ebb / al kheesa / al sakhama / lusail',
    'pearl / leqtaifiya / al qassar',
  ],
  'al ebb / al kheesa / al sakhama / lusail': [
    'lusail / al kharayej / wadi al banat',
    'umm salal mohammed / umm salal ali',
  ],

  // ── Musheireb / Downtown Doha cluster (zones 3, 4, 13) ───────────────────
  'musheireb': [                      // zones 4, 13
    'fereej mohamed bin jassim / musheireb',
    'as salatah / al mirqab',
    'al najada / barahat al jufairi',
    'fereej bin mahmoud',
    'rawdat al khail',
    'fereej abdel aziz',
  ],
  'fereej mohamed bin jassim / musheireb': [ // zone 3
    'musheireb',
    'as salatah / al mirqab',
    'al najada / barahat al jufairi',
    'al bidda',
  ],
  'al najada / barahat al jufairi': [ // zone 5
    'musheireb',
    'fereej mohamed bin jassim / musheireb',
    'al bidda',
    'al souq',
    'as salatah / al mirqab',
  ],
  'al bidda': [                       // zones 2, 12
    'al najada / barahat al jufairi',
    'musheireb',
    'fereej mohamed bin jassim / musheireb',
    'al souq',
    'doha port',
  ],
  'al souq': [                        // zone 7
    'al bidda',
    'al najada / barahat al jufairi',
    'doha port',
    'old al ghanim',
  ],
  'old al ghanim': [                  // zones 6, 16
    'al souq',
    'doha port',
    'fereej abdel aziz',
  ],
  'doha port': [                      // zone 19
    'al bidda',
    'al souq',
    'old al ghanim',
    'al khulaifat / ras abu aboud',
  ],

  // ── Al Sadd cluster (zones 38, 39) ───────────────────────────────────────
  'al sadd': [                        // zone 38
    'al sadd / new al mirqab / fereej al nasr',
    'najma',
    'fereej bin mahmoud',
    'rawdat al khail',
    'al hilal',
    'madinat khalifa north / dahl al hamam',
    'al markhiya',
  ],
  'al sadd / new al mirqab / fereej al nasr': [ // zone 39
    'al sadd',
    'najma',
    'fereej bin mahmoud',
    'al hilal',
    'new salatah',
  ],

  // ── Fereej Bin Mahmoud / Najma / Mansoura (zones 22, 23, 25, 26) ─────────
  'fereej bin mahmoud': [             // zones 22, 23
    'al sadd',
    'al sadd / new al mirqab / fereej al nasr',
    'najma',
    'musheireb',
    'rawdat al khail',
    'fereej bin durham / al mansoura',
    'fereej abdel aziz',
  ],
  'najma': [                          // zone 26
    'al sadd',
    'al sadd / new al mirqab / fereej al nasr',
    'fereej bin mahmoud',
    'fereej bin durham / al mansoura',
    'umm ghuwailina',
  ],
  'fereej bin durham / al mansoura': [ // zone 25
    'fereej bin mahmoud',
    'najma',
    'umm ghuwailina',
    'rawdat al khail',
  ],
  'rawdat al khail': [                // zone 24
    'al sadd',
    'fereej bin mahmoud',
    'musheireb',
    'fereej abdel aziz',
    'fereej bin durham / al mansoura',
  ],
  'fereej abdel aziz': [              // zone 14
    'musheireb',
    'fereej bin mahmoud',
    'rawdat al khail',
    'old al ghanim',
    'ad dawhah al jadidah',
  ],
  'ad dawhah al jadidah': [           // zone 15
    'fereej abdel aziz',
    'al rufaa / old al hitmi',
  ],
  'al rufaa / old al hitmi': [        // zone 17
    'ad dawhah al jadidah',
    'umm ghuwailina',
  ],
  'umm ghuwailina': [                 // zone 27
    'najma',
    'fereej bin durham / al mansoura',
    'al rufaa / old al hitmi',
    'new salatah',
    'al khulaifat / ras abu aboud',
  ],

  // ── Madinat Khalifa / Dahl Al Hamam cluster (zones 32, 33, 34) ───────────
  'madinat khalifa north / dahl al hamam': [ // zone 32
    'madinat khalifa south',
    'al markhiya',
    'al sadd',
    'al gharrafa / gharrafat al rayyan',
    'umm lekhba',
  ],
  'madinat khalifa south': [          // zone 34
    'madinat khalifa north / dahl al hamam',
    'al markhiya',
    'al messila',
    'al waab / al aziziya / abu hamour',
    'fereej bin omran / hamad medical city',
  ],
  'al markhiya': [                    // zone 33
    'madinat khalifa north / dahl al hamam',
    'madinat khalifa south',
    'al sadd',
    'al gharrafa / gharrafat al rayyan',
    'hazm al markhiya',
  ],
  'hazm al markhiya': [               // zone 67
    'al markhiya',
    'al gharrafa / gharrafat al rayyan',
    'jelaiah / al tarfa / jeryan nejaima',
    'onaiza',
  ],
  'jelaiah / al tarfa / jeryan nejaima': [ // zone 68
    'hazm al markhiya',
    'al thumama',
  ],
  'umm lekhba': [                     // zone 31
    'madinat khalifa north / dahl al hamam',
    'al gharrafa / gharrafat al rayyan',
    'duhail',
  ],
  'duhail': [                         // zone 30
    'umm lekhba',
    'al gharrafa / gharrafat al rayyan',
    'umm salal mohammed / umm salal ali',
  ],
  'fereej bin omran / hamad medical city': [ // zone 37
    'madinat khalifa south',
    'al messila',
    'nuaija',
    'fereej kulaib',
  ],
  'al messila': [                     // zone 36
    'madinat khalifa south',
    'fereej bin omran / hamad medical city',
    'al waab / al aziziya / abu hamour',
    'fereej kulaib',
    'nuaija',
  ],
  'fereej kulaib': [                  // zone 35
    'al messila',
    'nuaija',
    'fereej bin omran / hamad medical city',
  ],

  // ── Al Hilal / New Salatah / Old Airport (zones 40, 42, 45) ─────────────
  'al hilal': [                       // zone 42
    'al sadd',
    'al sadd / new al mirqab / fereej al nasr',
    'new salatah',
    'old airport',
  ],
  'new salatah': [                    // zone 40
    'al hilal',
    'al sadd / new al mirqab / fereej al nasr',
    'umm ghuwailina',
    'old airport',
  ],
  'old airport': [                    // zone 45
    'al hilal',
    'new salatah',
    'al khulaifat / ras abu aboud',
    'nuaija',
    'al thumama',
  ],
  'al khulaifat / ras abu aboud': [   // zone 28
    'old airport',
    'umm ghuwailina',
    'doha port',
  ],

  // ── Nuaija / Al Thumama cluster (zones 41/43/44, 46/47/50) ──────────────
  'nuaija': [                         // zones 41, 43, 44
    'old airport',
    'al thumama',
    'al messila',
    'fereej kulaib',
    'fereej bin omran / hamad medical city',
  ],
  'al thumama': [                     // zones 46, 47, 50
    'old airport',
    'nuaija',
    'jelaiah / al tarfa / jeryan nejaima',
    'doha international airport',
    'al wukair / al mashaf',
  ],
  'doha international airport': [     // zone 48
    'al thumama',
    'ras abu fontas',
  ],
  'ras abu fontas': [                 // zone 49
    'doha international airport',
    'al thumama',
    'mesaieed',
  ],

  // ── Al Rayyan Municipality ────────────────────────────────────────────────
  'al gharrafa / gharrafat al rayyan': [ // zone 51
    'madinat khalifa north / dahl al hamam',
    'al markhiya',
    'hazm al markhiya',
    'umm lekhba',
    'duhail',
    'old al rayyan / al luqta',
    'umm salal mohammed / umm salal ali',
  ],
  'old al rayyan / al luqta': [       // zone 52
    'al gharrafa / gharrafat al rayyan',
    'new al rayyan / muaither',
    'muraikh / fereej al amir',
  ],
  'new al rayyan / muaither': [       // zone 53
    'old al rayyan / al luqta',
    'muraikh / fereej al amir',
  ],
  'muraikh / fereej al amir': [       // zone 54
    'old al rayyan / al luqta',
    'new al rayyan / muaither',
    'al waab / al aziziya / abu hamour',
  ],
  'al waab / al aziziya / abu hamour': [ // zone 55
    'madinat khalifa south',
    'al messila',
    'muraikh / fereej al amir',
    'ain khaled / mesaimeer / bu samra',
  ],
  'ain khaled / mesaimeer / bu samra': [ // zone 56
    'al waab / al aziziya / abu hamour',
    'mesaieed',
  ],

  // ── Umm Salal Municipality ────────────────────────────────────────────────
  'umm salal mohammed / umm salal ali': [ // zone 71
    'al gharrafa / gharrafat al rayyan',
    'duhail',
    'al ebb / al kheesa / al sakhama / lusail',
  ],

  // ── Al Wakrah Municipality ────────────────────────────────────────────────
  'al wakrah': [                      // zone 90
    'al wukair / al mashaf',
  ],
  'al wukair / al mashaf': [          // zone 91
    'al wakrah',
    'mesaieed',
    'al thumama',
  ],
  'mesaieed': [                       // zone 92
    'al wukair / al mashaf',
    'ras abu fontas',
    'mesaieed industrial area',
    'ain khaled / mesaimeer / bu samra',
  ],
  'mesaieed industrial area': [       // zone 93
    'mesaieed',
    'shagra',
  ],
  'shagra': [                         // zone 94
    'al wukair / al mashaf',
    'mesaieed industrial area',
    'al kharrara',
  ],
  'al kharrara': [                    // zone 95
    'shagra',
  ],

  // ── Al Khor Municipality ──────────────────────────────────────────────────
  'simaisma / al khor city': [        // zone 74
    'al thakhira / ras laffan',
    'al ghuwariyah',
    'ain sinan / fuwayrit',
  ],
  'al thakhira / ras laffan': [       // zone 75
    'simaisma / al khor city',
    'al ghuwariyah',
  ],
  'al ghuwariyah': [                  // zone 76
    'simaisma / al khor city',
    'al thakhira / ras laffan',
    'ain sinan / fuwayrit',
  ],

  // ── Al Shamal Municipality ────────────────────────────────────────────────
  'ain sinan / fuwayrit': [           // zone 77
    'simaisma / al khor city',
    'al ghuwariyah',
    'abu dhalouf / zubarah',
  ],
  'abu dhalouf / zubarah': [          // zone 78
    'ain sinan / fuwayrit',
    'madinat ash shamal / ar ru\'ays',
  ],
  'madinat ash shamal / ar ru\'ays': [ // zone 79
    'abu dhalouf / zubarah',
  ],
};

function isAdjacentZone(unitZone: string, preferredZones: string[]): boolean {
  const unitNorm = unitZone.toLowerCase().trim();
  // Unit zone may contain "/" for dual-zone units (e.g. "West Bay / Al Dafna")
  const unitParts = unitNorm.split(/\s*\/\s*/);
  return preferredZones.some(pz => {
    const pzNorm = pz.toLowerCase().trim();
    const adjacents = ZONE_ADJACENCY[pzNorm] ?? [];
    return unitParts.some(part => adjacents.includes(part));
  });
}

// ── Config helpers ────────────────────────────────────────────────────────────

function normConfig(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/bedroom(s)?|bhk|br\b/g, '');
}

function bedroomCount(normed: string): number | null {
  const m = normed.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function matchConfig(inqConfig: string, unitConfig: string): 'exact' | 'partial' | false {
  const inqN = normConfig(inqConfig);
  const uN   = normConfig(unitConfig);
  if (!inqN || !uN) return false;
  if (inqN === uN)  return 'exact';

  // Numeric bedroom count must agree — Studio ≠ 1BHK ≠ 2BHK
  const inqBeds = bedroomCount(inqN);
  const uBeds   = bedroomCount(uN);
  if (inqBeds !== null && uBeds !== null && inqBeds !== uBeds) return false;
  if ((inqBeds === null) !== (uBeds === null)) return false;

  // Same count, different suffix (e.g. "2BHK" vs "2BHK+Maid") → partial
  if (uN.includes(inqN) || inqN.includes(uN)) return 'partial';
  return false;
}

// ── Priority key for tie-breaking ─────────────────────────────────────────────
// Encodes field match quality into a single integer.
// Each field occupies a fixed digit band so the comparison is stable.
//
// Band allocation (most-significant first):
//   config exact=3, partial=2, neutral=1, miss=0     × 10^6
//   budget_min exact=2, flex=1, neutral=1, miss=0    × 10^5
//   zone exact=2, neutral=1, miss=0                  × 10^4
//   type match=2, neutral=1, miss=0                  × 10^3
//   bathrooms match=2, neutral=1, miss=0             × 10^2
//   furnishing match=2, neutral=1, miss=0            × 10^1
//   budget_fit within=2, over=1, null=1              × 10^0
function makePriority(
  config:     'exact' | 'partial' | false | null,
  budgetMin:  'exact' | 'flex' | false,
  zone:       'exact' | 'adjacent' | false | null,
  type:       boolean | null,
  bathrooms:  boolean | null,
  furnishing: boolean | null,
  budgetFit:  'within' | 'over' | null,
): number {
  const c = config === 'exact' ? 3 : config === 'partial' ? 2 : config === null ? 1 : 0;
  const b = budgetMin === 'exact' ? 2 : budgetMin === 'flex' ? 1 : 0;
  const z = zone === 'exact' ? 2 : zone === 'adjacent' ? 1 : zone === null ? 1 : 0;
  const t = type === true ? 2 : type === null ? 1 : 0;
  const ba = bathrooms === true ? 2 : bathrooms === null ? 1 : 0;
  const f = furnishing === true ? 2 : furnishing === null ? 1 : 0;
  const bf = budgetFit === 'within' ? 2 : 1;
  return c * 1_000_000 + b * 100_000 + z * 10_000 + t * 1_000 + ba * 100 + f * 10 + bf;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function runMatchingEngine(inquiry: InquiryPayload, units: UnitRow[]): MatchResult[] {
  const results: MatchResult[] = [];

  const budgetMin = inquiry.budget_min ?? 0;
  // Treat 0 / null / undefined max as "no upper ceiling"
  const budgetMax = inquiry.budget_max && inquiry.budget_max > 0 ? inquiry.budget_max : null;

  const hasZonePref      = (inquiry.preferred_zones?.length ?? 0) > 0;
  const hasTypePref      = !!inquiry.property_type;
  const hasConfigPref    = !!inquiry.config;
  const hasBathroomsPref = inquiry.bathrooms_min != null && inquiry.bathrooms_min > 0;
  const hasFurnishPref   = !!inquiry.furnishing && inquiry.furnishing !== 'Any';

  for (const unit of units) {
    if (unit.status !== 'Available') continue;

    // ── Hard gate: listing type ────────────────────────────────────────────────
    if (inquiry.listing_type && unit.listing_type !== inquiry.listing_type) continue;

    // ── Budget hard gate (±10%) ───────────────────────────────────────────────
    // Units outside this window are excluded entirely.
    let budgetMinMatch: 'exact' | 'flex' | false = false;

    if (budgetMin > 0) {
      if (unit.rent >= budgetMin) {
        budgetMinMatch = 'exact';          // rent at or above floor
      } else if (unit.rent >= budgetMin * 0.9) {
        budgetMinMatch = 'flex';           // within 10% below floor
      } else {
        continue;                          // too cheap — excluded
      }
    } else {
      budgetMinMatch = 'exact';            // no floor specified — always passes
    }

    if (budgetMax !== null) {
      // Ceiling hard gate: exclude if rent exceeds max by more than 10%
      if (unit.rent > budgetMax * 1.1) continue;
    }

    // ── Budget ceiling fit (secondary) ────────────────────────────────────────
    let budgetFit: 'within' | 'over' | null = null;
    if (budgetMax !== null) {
      budgetFit = unit.rent <= budgetMax ? 'within' : 'over';
    }

    // ── Zone ──────────────────────────────────────────────────────────────────
    let zoneMatch: 'exact' | 'adjacent' | false | null = null;
    if (hasZonePref) {
      const zoneParts = (unit.zone ?? '')
        .toLowerCase()
        .split(/\s*\/\s*/)
        .map(p => p.trim());
      const exactHit = (inquiry.preferred_zones ?? [])
        .some(z => zoneParts.includes(z.toLowerCase().trim()));
      if (exactHit) {
        zoneMatch = 'exact';
      } else if (isAdjacentZone(unit.zone ?? '', inquiry.preferred_zones ?? [])) {
        zoneMatch = 'adjacent';
      } else {
        zoneMatch = false;
      }
    }

    // ── Property type ─────────────────────────────────────────────────────────
    let typeMatch: boolean | null = null;
    if (hasTypePref) {
      typeMatch = unit.type?.toLowerCase() === inquiry.property_type!.toLowerCase();
    }

    // ── Config ────────────────────────────────────────────────────────────────
    let configMatch: 'exact' | 'partial' | false | null = null;
    if (hasConfigPref) {
      configMatch = matchConfig(inquiry.config!, unit.config ?? '');
    }

    // ── Bathrooms ─────────────────────────────────────────────────────────────
    let bathroomMatch: boolean | null = null;
    if (hasBathroomsPref) {
      bathroomMatch = unit.bathrooms >= inquiry.bathrooms_min!;
    }

    // ── Furnishing ────────────────────────────────────────────────────────────
    let furnishingMatch: boolean | null = null;
    if (hasFurnishPref) {
      furnishingMatch = unit.furnishing?.toLowerCase() === inquiry.furnishing!.toLowerCase();
    }

    // ── Score (out of 100) ────────────────────────────────────────────────────

    let score = 0;

    // Config (30) — primary
    if      (configMatch === 'exact')   score += W_CONFIG;
    else if (configMatch === 'partial') score += Math.round(W_CONFIG * 0.60); // 18
    else if (configMatch === null)      score += Math.round(W_CONFIG * 0.50); // 15 neutral
    // false → 0 (mismatch, no points)

    // Budget Min (20) — primary
    if      (budgetMinMatch === 'exact') score += W_BUDGET_MIN;
    else if (budgetMinMatch === 'flex')  score += Math.round(W_BUDGET_MIN * 0.60); // 12

    // Zone (20) — primary
    if      (zoneMatch === 'exact')    score += W_ZONE;                       // 20
    else if (zoneMatch === 'adjacent') score += Math.round(W_ZONE * 0.60);   // 12 radius fallback
    else if (zoneMatch === null)       score += Math.round(W_ZONE * 0.50);   // 10 neutral (no pref)
    // false → 0 (zone specified but no match, not adjacent)

    // Property Type (10) — primary
    if      (typeMatch === true)  score += W_TYPE;
    else if (typeMatch === null)  score += Math.round(W_TYPE * 0.50);        // 5 neutral
    // false → 0

    // Bathrooms (8) — secondary
    if      (bathroomMatch === true)  score += W_BATHROOMS;
    else if (bathroomMatch === null)  score += Math.round(W_BATHROOMS * 0.50); // 4 neutral
    // false → 0

    // Furnishing (7) — secondary
    if      (furnishingMatch === true)  score += W_FURNISHING;
    else if (furnishingMatch === null)  score += Math.round(W_FURNISHING * 0.50); // 3 neutral
    // false → 0

    // Budget Fit (5) — secondary
    if      (budgetFit === 'within') score += W_BUDGET_FIT;
    else if (budgetFit === 'over')   score += Math.round(W_BUDGET_FIT * 0.40); // 2
    else                             score += Math.round(W_BUDGET_FIT * 0.40); // 2 neutral (no ceiling)

    score = Math.min(100, Math.max(0, score));

    // ── Tier ──────────────────────────────────────────────────────────────────
    let tier: 1 | 2 | 3;
    if (score >= TIER1_SCORE) {
      tier = 1;
    } else if (score >= TIER2_SCORE) {
      tier = 2;
    } else {
      tier = 3;
    }

    const priority = makePriority(
      configMatch, budgetMinMatch, zoneMatch,
      typeMatch, bathroomMatch, furnishingMatch, budgetFit,
    );

    results.push({
      unitId:   unit.id,
      unitCode: unit.unit_code,
      unitSnapshot: {
        property:     unit.property,
        unit_no:      unit.unit_no,
        zone:         unit.zone,
        zone_code:    unit.zone_code,
        type:         unit.type,
        config:       unit.config,
        rent:         unit.rent,
        bathrooms:    unit.bathrooms,
        furnishing:   unit.furnishing,
        status:       unit.status,
        listing_type: unit.listing_type,
        view_types:   unit.view_types ?? [],
      },
      tier,
      score,
      priority,
      reasons: {
        budget:     budgetMinMatch,
        budget_fit: budgetFit,
        type:       typeMatch,
        config:     configMatch,
        bathrooms:  bathroomMatch,
        zone:       zoneMatch,
        furnishing: furnishingMatch,
      },
    });
  }

  // Primary sort: tier ASC, score DESC, then priority DESC (tie-break)
  results.sort((a, b) =>
    a.tier - b.tier ||
    b.score - a.score ||
    b.priority - a.priority
  );

  return results;
}
