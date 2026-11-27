import type { SupabaseClient } from '@supabase/supabase-js';
import { runMatchingEngine, UnitRow, InquiryPayload } from '@/lib/matchingEngine';
import { registry } from '@/lib/registryClient';
import { auditAllPortals, PortalAudit, PortalId } from '@/lib/portalReadiness';
import { canDraft } from '@/lib/listingDraft';

const TERMINAL = ['won', 'lost', 'cancelled', 'closed'];
export const UNIT_COLS =
  'id, unit_code, property, unit_no, zone, zone_code, type, config, rent, bathrooms, furnishing, status, listing_type, ' +
  'smart_code, master_code, view_types, floor, size_sqm, parking, kitchen, amenities, media_url, agency_fee';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function loadAvailableUnits(admin: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('units').select(UNIT_COLS).eq('status', 'Available').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function zoneNames(codes: (string | number)[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const uniq = Array.from(new Set(codes.map(c => Number(c)).filter(n => Number.isFinite(n))));
  if (!uniq.length) return m;
  const { data } = await registry.from('cr_zone_codes').select('zone_code, district_name').in('zone_code', uniq);
  (data ?? []).forEach((z: Row) => m.set(String(z.zone_code), z.district_name));
  return m;
}

export async function contactsFor(admin: SupabaseClient, unitIds: string[]): Promise<Map<string, { name: string | null; phone: string | null }>> {
  const m = new Map<string, { name: string | null; phone: string | null }>();
  for (let i = 0; i < unitIds.length; i += 200) {
    const { data } = await admin.from('unit_operational').select('unit_id, focal_point_name, focal_point_phone').in('unit_id', unitIds.slice(i, i + 200));
    (data ?? []).forEach((r: Row) => m.set(r.unit_id, { name: r.focal_point_name ?? null, phone: r.focal_point_phone ?? null }));
  }
  return m;
}

export interface DemandUnit {
  id: string; master_code: string | null; smart_code: string | null; property: string | null; unit_no: string | null;
  type: string | null; config: string | null; rent: number | null; zone_name: string | null; furnishing: string | null;
  demand: { total: number; tier1: number; tier2: number; tier3: number };
  contact: { name: string | null; phone: string | null };
  media_url: string | null;
  audit: Record<PortalId, PortalAudit>;
  listed: boolean;
}

const BANDS: [string, number, number][] = [['< 4,000', 0, 4000], ['4,000–6,000', 4000, 6000], ['6,000–8,000', 6000, 8000], ['8,000–12,000', 8000, 12000], ['12,000+', 12000, Infinity]];
const normCfg = (c: string | null | undefined) => { const s = (c ?? '').trim(); if (!s) return null; if (/studio/i.test(s)) return 'Studio'; const m = s.match(/(\d+)\s*(?:bhk|br|bed)/i); return m ? `${m[1]} BHK` : s; };
const tally = (xs: (string | null | undefined)[]) => {
  const m = new Map<string, number>();
  xs.forEach(x => { const k = (x ?? '').trim() || '(not specified)'; m.set(k, (m.get(k) ?? 0) + 1); });
  return Array.from(m, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};

export async function buildDemand(admin: SupabaseClient, limit: number) {
  const { data: inqs, error } = await admin
    .from('inquiries')
    .select('listing_type, property_type, config, budget_min, budget_max, bathrooms_min, preferred_zones, furnishing, status')
    .not('status', 'in', `(${TERMINAL.join(',')})`);
  if (error) throw new Error(error.message);
  const inquiries = (inqs ?? []) as unknown as (InquiryPayload & Row)[];
  const units = await loadAvailableUnits(admin);

  // ── Demand patterns (aggregates only — no client or inquiry identifiers leave the server) ──
  const zoneTally = new Map<string, number>();
  inquiries.forEach(i => (i.preferred_zones ?? []).forEach((z: string) => zoneTally.set(z, (zoneTally.get(z) ?? 0) + 1)));
  const band = (i: Row) => { const v = i.budget_max || i.budget_min; if (!v) return '(not specified)'; return BANDS.find(b => v >= b[1] && v < b[2])![0]; };
  const stock = (key: string) => { const m = new Map<string, number>(); units.forEach(u => m.set(u[key], (m.get(u[key]) ?? 0) + 1)); return m; };
  const cfgStock = stock('config'), typeStock = stock('type');
  const patterns = {
    activeInquiries: inquiries.length,
    availableUnits: units.length,
    listingType: tally(inquiries.map(i => i.listing_type)),
    propertyType: tally(inquiries.map(i => i.property_type)).map(x => ({ ...x, stock: typeStock.get(x.label) ?? 0 })),
    config: tally(inquiries.flatMap(i => i.config ? (i.config as string).split(',').map(normCfg).filter(Boolean) : [null])).map(x => ({ ...x, stock: cfgStock.get(x.label) ?? 0 })), // eslint-disable-line @typescript-eslint/no-explicit-any
    budget: tally(inquiries.map(band)),
    furnishing: tally(inquiries.map(i => i.furnishing)),
    zones: Array.from(zoneTally, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8),
  };

  // ── Per-unit demand: run the existing matching engine over every active inquiry ──
  const unitRows = units as unknown as UnitRow[];
  const score = new Map<string, { t1: number; t2: number; t3: number }>();
  inquiries.forEach(inq => {
    runMatchingEngine(inq, unitRows).forEach(r => {
      const s = score.get(r.unitId) ?? { t1: 0, t2: 0, t3: 0 };
      if (r.tier === 1) s.t1++; else if (r.tier === 2) s.t2++; else s.t3++;
      score.set(r.unitId, s);
    });
  });
  const ranked = units
    .filter(u => score.has(u.id))
    .sort((a, b) => {
      const A = score.get(a.id)!, B = score.get(b.id)!;
      return (B.t1 * 3 + B.t2 * 2 + B.t3) - (A.t1 * 3 + A.t2 * 2 + A.t3);
    })
    .slice(0, limit);

  const [zones, contacts, listedRes] = await Promise.all([
    zoneNames(ranked.map(u => u.zone_code)),
    contactsFor(admin, ranked.map(u => u.id)),
    admin.from('properties').select('unit_id').in('unit_id', ranked.map(u => u.id)),
  ]);
  const listed = new Set<string>(((listedRes.error ? [] : listedRes.data) ?? []).map((r: Row) => r.unit_id));

  const rows: DemandUnit[] = ranked.map(u => {
    const s = score.get(u.id)!;
    const c = contacts.get(u.id) ?? { name: null, phone: null };
    const zoneName = zones.get(String(u.zone_code)) ?? null;
    return {
      id: u.id, master_code: u.master_code, smart_code: u.smart_code, property: u.property, unit_no: u.unit_no,
      type: u.type, config: u.config, rent: u.rent == null ? null : Number(u.rent), zone_name: zoneName, furnishing: u.furnishing,
      demand: { total: s.t1 + s.t2 + s.t3, tier1: s.t1, tier2: s.t2, tier3: s.t3 },
      contact: c, media_url: u.media_url,
      audit: auditAllPortals({ unit: u, zoneName, contactName: c.name, contactPhone: c.phone, hasDraft: canDraft({ type: u.type, config: u.config }) }),
      listed: listed.has(u.id),
    };
  });
  return { patterns, units: rows };
}
