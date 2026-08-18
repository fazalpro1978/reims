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
  zone:       'exact' | false | null;
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
  zone:       'exact' | false | null,
  type:       boolean | null,
  bathrooms:  boolean | null,
  furnishing: boolean | null,
  budgetFit:  'within' | 'over' | null,
): number {
  const c = config === 'exact' ? 3 : config === 'partial' ? 2 : config === null ? 1 : 0;
  const b = budgetMin === 'exact' ? 2 : budgetMin === 'flex' ? 1 : 0;
  const z = zone === 'exact' ? 2 : zone === null ? 1 : 0;
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
    let zoneMatch: 'exact' | false | null = null;
    if (hasZonePref) {
      const zoneParts = (unit.zone ?? '')
        .toLowerCase()
        .split(/\s*\/\s*/)
        .map(p => p.trim());
      zoneMatch = (inquiry.preferred_zones ?? [])
        .some(z => zoneParts.includes(z.toLowerCase().trim()))
        ? 'exact'
        : false;
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
    if      (zoneMatch === 'exact')  score += W_ZONE;
    else if (zoneMatch === null)     score += Math.round(W_ZONE * 0.50);     // 10 neutral
    // false → 0 (wrong zone, no points)

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
