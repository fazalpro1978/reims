// ─────────────────────────────────────────────────────────────────────────────
// Inquiry Matching Engine — Weighted scoring with neutral-field handling
//
// Field weights (sum to 100):
//   Budget 35 · Zone 20 · Type 15 · Config 15 · Bathrooms 8 · Furnishing 7
//
// Score interpretation:
//   ≥ 70  → strong match (T1 when budget is exact)
//   45–69 → partial match (T2)
//   < 45  → weak / zone-buffered match (T3)
//
// Neutral scoring: when the client did not specify a preference, the field
// contributes half its weight. This keeps the baseline near 50 when no
// preferences are set and ensures specified-but-mismatched fields stand out.
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
  budget: 'exact' | 'flex' | false;
  type: boolean | null;
  config: 'exact' | 'partial' | false | null;
  bathrooms: boolean | null;
  zone: 'exact' | false | null;
  furnishing: boolean | null;
}

export interface MatchResult {
  unitId: string;
  unitCode: string;
  unitSnapshot: Record<string, unknown>;
  tier: 1 | 2 | 3;
  score: number;
  reasons: MatchReasons;
}

// Field weights — must stay synchronised with SCORE_WEIGHTS_DOC below
const W_BUDGET     = 35;
const W_ZONE       = 20;
const W_TYPE       = 15;
const W_CONFIG     = 15;
const W_BATHROOMS  =  8;
const W_FURNISHING =  7;

// Tier score thresholds
const TIER1_SCORE = 70; // T1 requires budget=exact AND score ≥ this
const TIER2_SCORE = 45; // T2 requires score ≥ this

function normConfig(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/bedroom(s)?|bhk|br\b/g, '');
}

// Extract the leading bedroom count digit(s) from a normalised config string.
// "3" → 3, "studio" → null, "" → null
function bedroomCount(normed: string): number | null {
  const m = normed.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function matchConfig(inqConfig: string, unitConfig: string): 'exact' | 'partial' | false {
  const inqN = normConfig(inqConfig);
  const uN   = normConfig(unitConfig);

  if (!inqN || !uN) return false;
  if (inqN === uN)  return 'exact';

  // Different bedroom counts → hard mismatch (Studio ≠ 1 BHK ≠ 2 BHK)
  const inqBeds = bedroomCount(inqN);
  const uBeds   = bedroomCount(uN);
  if (inqBeds !== null && uBeds !== null && inqBeds !== uBeds) return false;
  if (inqBeds === null && uBeds !== null) return false; // e.g. Studio vs 1BHK
  if (inqBeds !== null && uBeds === null) return false;

  // Same bedroom count, different suffix (e.g. "2BHK" vs "2BHK+Maid") → partial
  if (uN.includes(inqN) || inqN.includes(uN)) return 'partial';

  return false;
}

export function runMatchingEngine(inquiry: InquiryPayload, units: UnitRow[]): MatchResult[] {
  const results: MatchResult[] = [];

  const budgetMin = inquiry.budget_min ?? 0;
  // Treat 0 / null / undefined as "no upper cap"
  const budgetMax = inquiry.budget_max && inquiry.budget_max > 0 ? inquiry.budget_max : null;
  const hasZonePref      = (inquiry.preferred_zones?.length ?? 0) > 0;
  const hasTypePref      = !!inquiry.property_type;
  const hasConfigPref    = !!inquiry.config;
  const hasBathroomsPref = inquiry.bathrooms_min != null && inquiry.bathrooms_min > 0;
  const hasFurnishPref   = !!inquiry.furnishing && inquiry.furnishing !== 'Any';

  for (const unit of units) {
    if (unit.status !== 'Available') continue;

    // ── Hard gate: listing type ───────────────────────────────────────────────
    if (inquiry.listing_type && unit.listing_type !== inquiry.listing_type) continue;

    // ── Budget (hard gate + primary weight) ───────────────────────────────────
    let budgetMatch: 'exact' | 'flex' | false = false;

    if (budgetMax !== null) {
      // Both bounds set
      if (unit.rent >= budgetMin && unit.rent <= budgetMax) {
        budgetMatch = 'exact';
      } else if (unit.rent >= budgetMin * 0.9 && unit.rent <= budgetMax * 1.1) {
        budgetMatch = 'flex';
      } else {
        continue; // outside ±10% window — excluded
      }
    } else if (budgetMin > 0) {
      // Only min set — any rent at/above min passes as exact; 10% below min is flex
      if (unit.rent >= budgetMin) {
        budgetMatch = 'exact';
      } else if (unit.rent >= budgetMin * 0.9) {
        budgetMatch = 'flex';
      } else {
        continue;
      }
    } else {
      // No budget specified — passes freely, scored as exact
      budgetMatch = 'exact';
    }

    // ── Zone ─────────────────────────────────────────────────────────────────
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

    // ── Config / bedrooms ─────────────────────────────────────────────────────
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

    // ── Score calculation ─────────────────────────────────────────────────────
    //
    // Each field contributes its full weight on a match, half its weight when
    // the preference was not specified (neutral), and a small penalty or zero
    // on a mismatch (see table in file header).
    let score = 0;

    // Budget (35)
    if      (budgetMatch === 'exact') score += W_BUDGET;
    else if (budgetMatch === 'flex')  score += Math.round(W_BUDGET * 0.55); // 19

    // Zone (20)
    if      (zoneMatch === 'exact')   score += W_ZONE;
    else if (zoneMatch === null)      score += Math.round(W_ZONE * 0.5);    // 10 neutral
    else                              score -= 5;                            // wrong zone

    // Type (15)
    if      (typeMatch === true)      score += W_TYPE;
    else if (typeMatch === null)      score += Math.round(W_TYPE * 0.5);    // 7 neutral
    else                              score -= 5;                            // wrong type

    // Config (15)
    if      (configMatch === 'exact')   score += W_CONFIG;
    else if (configMatch === 'partial') score += Math.round(W_CONFIG * 0.55); // 8
    else if (configMatch === null)      score += Math.round(W_CONFIG * 0.5);  // 7 neutral
    else                                score -= 5;                            // wrong config

    // Bathrooms (8)
    if      (bathroomMatch === true)  score += W_BATHROOMS;
    else if (bathroomMatch === null)  score += Math.round(W_BATHROOMS * 0.5); // 4 neutral
    // false → 0 (minimum not met; no additional penalty)

    // Furnishing (7)
    if      (furnishingMatch === true)  score += W_FURNISHING;
    else if (furnishingMatch === null)  score += Math.round(W_FURNISHING * 0.5); // 3 neutral
    // false → 0 (soft preference; no penalty)

    score = Math.min(100, Math.max(0, score));

    // ── Tier determination ────────────────────────────────────────────────────
    // T1 — budget exact AND overall score strong
    // T2 — good score regardless of budget flex, OR exact budget with moderate score
    // T3 — anything else that cleared the budget gate
    let tier: 1 | 2 | 3;

    if (budgetMatch === 'exact' && score >= TIER1_SCORE) {
      tier = 1;
    } else if (score >= TIER2_SCORE) {
      tier = 2;
    } else {
      tier = 3;
    }

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
      reasons: {
        budget:     budgetMatch,
        type:       typeMatch,
        config:     configMatch,
        bathrooms:  bathroomMatch,
        zone:       zoneMatch,
        furnishing: furnishingMatch,
      },
    });
  }

  // Primary sort: tier ASC, secondary: score DESC
  results.sort((a, b) => a.tier - b.tier || b.score - a.score);
  return results;
}
