// ─────────────────────────────────────────────────────────────────────────────
// Inquiry Matching Engine — Tiered ranking with ±10% budget fallback
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
  config: boolean | null;
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

export function runMatchingEngine(inquiry: InquiryPayload, units: UnitRow[]): MatchResult[] {
  const results: MatchResult[] = [];

  const budgetMin = inquiry.budget_min ?? 0;
  const budgetMax = inquiry.budget_max ?? Infinity;
  const hasZonePref = (inquiry.preferred_zones?.length ?? 0) > 0;

  for (const unit of units) {
    if (unit.status !== 'Available') continue;

    // Listing type filter (hard gate)
    if (inquiry.listing_type && unit.listing_type !== inquiry.listing_type) continue;

    // ── Budget matching ───────────────────────────────────────────────────────
    let budgetMatch: 'exact' | 'flex' | false = false;
    if (unit.rent >= budgetMin && unit.rent <= budgetMax) {
      budgetMatch = 'exact';
    } else if (unit.rent >= budgetMin * 0.9 && unit.rent <= budgetMax * 1.1) {
      budgetMatch = 'flex';
    } else {
      continue; // outside ±10% — excluded
    }

    // ── Type matching ─────────────────────────────────────────────────────────
    let typeMatch: boolean | null = null;
    if (inquiry.property_type) {
      typeMatch = unit.type?.toLowerCase() === inquiry.property_type.toLowerCase();
    }

    // ── Config matching ───────────────────────────────────────────────────────
    let configMatch: boolean | null = null;
    if (inquiry.config) {
      const norm    = (s: string) => s.toLowerCase().replace(/\s+/g, '');
      const inqConf = norm(inquiry.config);
      const uConf   = norm(unit.config ?? '');
      configMatch = uConf === inqConf || uConf.includes(inqConf) || inqConf.includes(uConf);
    }

    // ── Bathroom matching ─────────────────────────────────────────────────────
    let bathroomMatch: boolean | null = null;
    if (inquiry.bathrooms_min != null) {
      bathroomMatch = unit.bathrooms >= inquiry.bathrooms_min;
    }

    // ── Zone matching ─────────────────────────────────────────────────────────
    // unit.zone may be a slash-separated hierarchy e.g. "Lusail / Jabal Thuaileb / Al Kharayej"
    let zoneMatch: 'exact' | false | null = null;
    if (hasZonePref) {
      const zoneParts = (unit.zone ?? '').toLowerCase().split(/\s*\/\s*/).map(p => p.trim());
      zoneMatch = (inquiry.preferred_zones ?? [])
        .some(z => zoneParts.includes(z.toLowerCase().trim()))
        ? 'exact'
        : false;
    }

    // ── Furnishing matching ───────────────────────────────────────────────────
    let furnishingMatch: boolean | null = null;
    if (inquiry.furnishing) {
      furnishingMatch = unit.furnishing?.toLowerCase() === inquiry.furnishing.toLowerCase();
    }

    // ── Score calculation ─────────────────────────────────────────────────────
    let score = 0;

    // Budget (30pts)
    score += budgetMatch === 'exact' ? 30 : 15;

    // Zone (25pts)
    if (zoneMatch === 'exact')  score += 25;
    else if (zoneMatch === false) score -= 10;

    // Type (20pts)
    if (typeMatch === true)  score += 20;
    else if (typeMatch === false) score -= 8;

    // Config (15pts)
    if (configMatch === true)  score += 15;

    // Bathrooms (5pts)
    if (bathroomMatch === true)  score += 5;
    else if (bathroomMatch === false) score -= 3;

    // Furnishing (5pts)
    if (furnishingMatch === true)  score += 5;

    score = Math.min(100, Math.max(0, score));

    // ── Tier determination ────────────────────────────────────────────────────
    let tier: 1 | 2 | 3;
    const zoneOk = zoneMatch === 'exact' || zoneMatch === null;

    if (budgetMatch === 'exact' && zoneOk) {
      tier = 1;
    } else if (budgetMatch === 'flex' && zoneOk) {
      tier = 2;
    } else if (budgetMatch === 'exact' && zoneMatch === false) {
      tier = 2;
    } else {
      tier = 3;
    }

    results.push({
      unitId:       unit.id,
      unitCode:     unit.unit_code,
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

  // Sort: tier ASC, score DESC
  results.sort((a, b) => a.tier - b.tier || b.score - a.score);
  return results;
}
