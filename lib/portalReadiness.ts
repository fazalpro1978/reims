// ─────────────────────────────────────────────────────────────────────────────
// Portal readiness rules — PropertyFinder & Qatar Living
//
// ONE TABLE drives everything. Edit RULES to change what counts as ready.
// Source: "Property Finder Requirements" + "Property Finder Requirements2" (PF listing form).
//   required    → must pass for the portal to show "Ready"
//   recommended → improves the score but never blocks "Ready" (floor, size, amenities, parking)
//
// PROVISIONAL: Qatar Living has no requirements document yet — it starts as a copy of the
// PropertyFinder rules. Replace QL_OVERRIDES when real requirements are available.
// ─────────────────────────────────────────────────────────────────────────────

export type PortalId = 'propertyfinder' | 'qatarliving';
export type CheckGroup = 'info' | 'pictures';

export const PORTALS: { id: PortalId; label: string; provisional: boolean }[] = [
  { id: 'propertyfinder', label: 'PropertyFinder', provisional: true },
  { id: 'qatarliving',    label: 'Qatar Living',   provisional: true },
];

export interface UnitFacts {
  smart_code?: string | null;
  master_code?: string | null;
  property?: string | null;
  unit_no?: string | null;
  zone_code?: string | number | null;
  type?: string | null;
  config?: string | null;
  bathrooms?: number | string | null;
  furnishing?: string | null;
  listing_type?: string | null;
  status?: string | null;
  rent?: number | string | null;
  floor?: string | null;
  size_sqm?: number | string | null;
  parking?: boolean | string | null;
  kitchen?: string | null;
  amenities?: string[] | string | null;
  media_url?: string | null;
  agency_fee?: number | string | null;
}

export interface AuditContext {
  unit: UnitFacts;
  zoneName: string | null;
  contactName: string | null;
  contactPhone?: string | null;
  hasDraft: boolean;          // a title/description can be generated from the unit's facts
}

interface Rule {
  key: string;
  label: string;
  level: 'required' | 'recommended';
  group: CheckGroup;
  test: (c: AuditContext) => boolean;
  portals?: PortalId[];       // omitted = all portals
}

const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '[]';
const num = (v: unknown) => (has(v) && !Number.isNaN(Number(v)) ? Number(v) : null);

export const RULES: Rule[] = [
  // ── Core details (PF mandatory) ───────────────────────────────────────────
  { key: 'reference',   label: 'Reference (≤50 chars)', level: 'required', group: 'info',
    test: c => has(c.unit.smart_code) && String(c.unit.smart_code).length <= 50 },
  { key: 'offering',    label: 'Offering type',         level: 'required', group: 'info',
    test: c => /^(rent|sale)$/i.test(String(c.unit.listing_type ?? '')) },
  { key: 'rental',      label: 'Rental period',         level: 'required', group: 'info',
    test: c => !/^rent$/i.test(String(c.unit.listing_type ?? '')) || num(c.unit.rent) !== null }, // Rent → per month
  { key: 'ptype',       label: 'Property type',         level: 'required', group: 'info',
    test: c => has(c.unit.type) },
  { key: 'location',    label: 'Location',              level: 'required', group: 'info',
    test: c => has(c.zoneName) || has(c.unit.property) },
  { key: 'agent',       label: 'Assigned contact',      level: 'required', group: 'info',
    test: c => has(c.contactName) || has(c.contactPhone) },
  { key: 'available',   label: 'Availability',          level: 'required', group: 'info',
    test: c => /^available$/i.test(String(c.unit.status ?? '')) },
  // ── Specifications ────────────────────────────────────────────────────────
  { key: 'bedrooms',    label: 'Bedrooms',              level: 'required', group: 'info',
    test: c => has(c.unit.config) },
  { key: 'bathrooms',   label: 'Bathrooms',             level: 'required', group: 'info',
    test: c => num(c.unit.bathrooms) !== null },
  { key: 'furnishing',  label: 'Furnishing',            level: 'required', group: 'info',
    test: c => has(c.unit.furnishing) },
  { key: 'size',        label: 'Size (sqm)',            level: 'recommended', group: 'info',
    test: c => (num(c.unit.size_sqm) ?? 0) > 0 },
  { key: 'floor',       label: 'Floor number',          level: 'recommended', group: 'info',
    test: c => has(c.unit.floor) },
  { key: 'parking',     label: 'Parking spaces',        level: 'recommended', group: 'info',
    test: c => has(c.unit.parking) },
  // ── Price / amenities / description ───────────────────────────────────────
  { key: 'price',       label: 'Price',                 level: 'required', group: 'info',
    test: c => (num(c.unit.rent) ?? 0) > 0 },
  { key: 'amenities',   label: 'Amenities',             level: 'recommended', group: 'info',
    test: c => Array.isArray(c.unit.amenities) ? c.unit.amenities.length > 0 : has(c.unit.amenities) },
  { key: 'description', label: 'Title & description',   level: 'required', group: 'info',
    test: c => c.hasDraft },
  // ── Media ─────────────────────────────────────────────────────────────────
  // A link (photo, gallery, Drive folder or video) counts as "pictures available".
  { key: 'pictures',    label: 'Pictures (link)',       level: 'required', group: 'pictures',
    test: c => has(c.unit.media_url) },
];

// Qatar Living: PROVISIONAL — identical to PropertyFinder until its requirements are supplied.
const QL_OVERRIDES: Partial<Record<string, Partial<Pick<Rule, 'level'>>>> = {};

export interface CheckResult { key: string; label: string; level: 'required' | 'recommended'; group: CheckGroup; pass: boolean }
export interface PortalAudit {
  portal: PortalId;
  ready: boolean;              // every required check passes
  infoComplete: boolean;       // every required non-picture check passes
  picturesOk: boolean;
  score: number;               // 0-100, required checks weigh 2, recommended 1
  missingRequired: string[];
  missingRecommended: string[];
  checks: CheckResult[];
}

export function auditPortal(portal: PortalId, ctx: AuditContext): PortalAudit {
  const rules = RULES
    .filter(r => !r.portals || r.portals.includes(portal))
    .map(r => ({ ...r, ...(portal === 'qatarliving' ? QL_OVERRIDES[r.key] : {}) }));
  const checks: CheckResult[] = rules.map(r => ({ key: r.key, label: r.label, level: r.level, group: r.group, pass: r.test(ctx) }));
  const w = (c: CheckResult) => (c.level === 'required' ? 2 : 1);
  const total = checks.reduce((s, c) => s + w(c), 0);
  const got   = checks.reduce((s, c) => s + (c.pass ? w(c) : 0), 0);
  const req   = checks.filter(c => c.level === 'required');
  return {
    portal,
    ready:        req.every(c => c.pass),
    infoComplete: req.filter(c => c.group === 'info').every(c => c.pass),
    picturesOk:   req.filter(c => c.group === 'pictures').every(c => c.pass),
    score:        total ? Math.round((got / total) * 100) : 0,
    missingRequired:    checks.filter(c => c.level === 'required' && !c.pass).map(c => c.label),
    missingRecommended: checks.filter(c => c.level === 'recommended' && !c.pass).map(c => c.label),
    checks,
  };
}

export const auditAllPortals = (ctx: AuditContext) =>
  Object.fromEntries(PORTALS.map(p => [p.id, auditPortal(p.id, ctx)])) as Record<PortalId, PortalAudit>;

// ── PropertyFinder amenity vocabulary (from the listing form) ────────────────
export const PF_AMENITIES = [
  'Balcony', 'Barbecue Area', 'Built in Wardrobes', 'Central A/C', 'Covered Parking', 'Private Gym',
  'Private Jacuzzi', 'Kitchen Appliances', 'Maids Room', 'Pets Allowed', 'Private Garden', 'Private Pool',
  'Shared Pool', 'Study', 'View of Water', 'Security', 'Concierge', 'Shared Spa', 'Shared Gym',
  'Maid Service', 'Walk-in Closet', 'View of Landmark', "Children's Play Area", 'Lobby in Building', "Children's Pool",
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Only unambiguous synonyms. Pool / gym / parking are NOT mapped (private vs shared, covered vs open) — they show as unmapped.
const SYNONYMS: Record<string, string> = {
  centralac: 'Central A/C', centralairconditioning: 'Central A/C',
  maidsroom: 'Maids Room', maidroom: 'Maids Room',
  builtinwardrobe: 'Built in Wardrobes', builtinwardrobes: 'Built in Wardrobes',
  walkincloset: 'Walk-in Closet', walkinwardrobe: 'Walk-in Closet',
  '24hsecurity': 'Security', lobby: 'Lobby in Building',
};
const PF_BY_NORM = new Map(PF_AMENITIES.map(a => [norm(a), a]));

// Map REIMS amenity names onto PropertyFinder's. Anything that doesn't match is returned, never guessed.
export function mapAmenities(list: string[] | string | null | undefined): { mapped: string[]; unmapped: string[] } {
  let arr: string[] = [];
  if (Array.isArray(list)) arr = list;
  else if (typeof list === 'string' && list.trim()) { try { const p = JSON.parse(list); if (Array.isArray(p)) arr = p; } catch { arr = list.split(','); } }
  const mapped = new Set<string>(); const unmapped: string[] = [];
  arr.map(a => String(a).trim()).filter(Boolean).forEach(a => {
    const hit = PF_BY_NORM.get(norm(a)) ?? SYNONYMS[norm(a)];
    if (hit) mapped.add(hit); else unmapped.push(a);
  });
  return { mapped: Array.from(mapped), unmapped };
}
