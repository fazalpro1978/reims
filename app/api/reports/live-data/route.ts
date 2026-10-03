import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const TERMINAL = ['won', 'lost', 'cancelled', 'closed'];

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function ingest() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'ingest' } },
  );
}

function countBy<T>(rows: T[], key: keyof T): { label: string; v: number }[] {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const val = String(r[key] ?? 'Unknown');
    m[val] = (m[val] ?? 0) + 1;
  }
  return Object.entries(m)
    .map(([label, v]) => ({ label, v }))
    .sort((a, b) => b.v - a.v);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['superuser', 'administrator', 'staff']);
  if (!auth.ok) return auth.response;

  const sb = admin();
  const ic = ingest();

  const [
    unitsRes,
    agentsRes,
    zoneCodesRes,
    entityCodesRes,
    smartCodesRes,
    runsRes,
    inquiriesRes,
  ] = await Promise.all([
    sb.from('units').select(
      'status,type,zone,config,furnishing,rent,deposit_amount,kahramaa_applicable,kahramaa_amount,month_free_applicable,unit_code,property,service_charges,booking_fee'
    ),
    sb.from('cr_agents').select('id', { count: 'exact', head: true }),
    sb.from('cr_zone_codes').select('id', { count: 'exact', head: true }),
    sb.from('cr_entity_codes').select('id', { count: 'exact', head: true }),
    sb.from('cr_smart_code_sequences').select('id', { count: 'exact', head: true }),
    ic.from('upload_runs').select('id,status,record_count,approved_count,uploaded_at').order('uploaded_at', { ascending: false }).limit(50),
    sb.from('inquiries').select('status,match_count,source,budget_min,budget_max,created_at'),
  ]);

  const units = unitsRes.data ?? [];
  const totalUnits = units.length;

  // ── Operational ──────────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {};
  for (const u of units) {
    const s = u.status ?? 'Unknown';
    statusMap[s] = (statusMap[s] ?? 0) + 1;
  }
  const available   = statusMap['Available']          ?? 0;
  const leased      = statusMap['Leased']             ?? 0;
  const reserved    = statusMap['Reserved']           ?? 0;
  const maintenance = statusMap['Under_Maintenance']  ?? 0;
  const lookupQueue = statusMap['Look_Up_Queue']      ?? 0;

  const typeBreakdown    = countBy(units, 'type');
  const zoneBreakdown    = countBy(units, 'zone');
  const configBreakdown  = countBy(units, 'config');
  const furnishBreakdown = countBy(units, 'furnishing');

  // ── Ingestion ─────────────────────────────────────────────────────────────
  const runs       = runsRes.data ?? [];
  const totalRuns  = runs.length;
  const totalIngested = runs.reduce((s, r) => s + (r.record_count ?? 0), 0);
  const totalApproved = runs.reduce((s, r) => s + (r.approved_count ?? 0), 0);
  const schemaErrors  = runs.filter(r => r.status === 'failed').length;

  // Approximate ingestion status breakdown from record_count vs approved_count
  const stNew       = totalApproved;
  const stUpdated   = Math.max(0, totalIngested - totalApproved - schemaErrors);
  const stUnchanged = Math.max(0, totalIngested - stNew - stUpdated - schemaErrors);

  // Last 8 runs for sparkline
  const recentRuns = runs.slice(0, 8).reverse().map(r => ({
    label: r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '?',
    v: r.record_count ?? 0,
  }));

  // ── Governance ─────────────────────────────────────────────────────────────
  const smartCodesIssued = smartCodesRes.count ?? 0;
  const nullSmartCodes   = units.filter(u => !u.unit_code).length;

  // Master codes = how many unique unit_code prefixes (first 8 chars = DDMMHHMM)
  const masterCodes = new Set(
    units.filter(u => u.unit_code).map(u => u.unit_code!.slice(0, 8))
  ).size;

  // Unique property prefixes as alias proxies
  const uniqueProperties = new Set(units.filter(u => u.property).map(u => u.property)).size;

  // ── Financial ──────────────────────────────────────────────────────────────
  const rents = units.map(u => Number(u.rent) || 0).filter(r => r > 0);
  const avgRent = rents.length > 0
    ? Math.round(rents.reduce((s, r) => s + r, 0) / rents.length)
    : 0;
  const portfolioMonthlyRent = rents.reduce((s, r) => s + r, 0);
  const monthFreeCount = units.filter(u => u.month_free_applicable === true).length;
  const deposits = units.map(u => Number(u.deposit_amount) || 0).filter(d => d > 0);
  const avgDeposit = deposits.length > 0
    ? Math.round(deposits.reduce((s, d) => s + d, 0) / deposits.length)
    : 0;
  const kahramaaAmounts = units
    .filter(u => u.kahramaa_applicable === true && u.kahramaa_amount)
    .map(u => Number(u.kahramaa_amount) || 0)
    .filter(k => k > 0);
  const avgKahramaa = kahramaaAmounts.length > 0
    ? Math.round(kahramaaAmounts.reduce((s, k) => s + k, 0) / kahramaaAmounts.length)
    : 0;

  // Rent by property (top 10)
  const rentByProperty: Record<string, { total: number; count: number }> = {};
  for (const u of units) {
    const p = u.property ?? 'Unknown';
    if (!rentByProperty[p]) rentByProperty[p] = { total: 0, count: 0 };
    const r = Number(u.rent) || 0;
    if (r > 0) {
      rentByProperty[p].total += r;
      rentByProperty[p].count += 1;
    }
  }
  const rentBars = Object.entries(rentByProperty)
    .map(([label, { total, count }]) => ({ label, v: count > 0 ? Math.round(total / count) : 0 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 10);

  // ── Registry ───────────────────────────────────────────────────────────────
  const registeredAgents = agentsRes.count ?? 0;
  const activeZones      = zoneCodesRes.count ?? 0;
  const entityCodes      = entityCodesRes.count ?? 0;
  const zonesWithUnits   = new Set(units.filter(u => u.zone).map(u => u.zone)).size;

  // Top zones by unit count
  const zoneTopBars = zoneBreakdown.slice(0, 10);

  // ── Executive ──────────────────────────────────────────────────────────────
  const occupied     = leased + reserved + maintenance;
  const occupancyPct = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;
  const availRate    = totalUnits > 0 ? Math.round((available / totalUnits) * 100) : 0;

  // Growth sparkline — units added per run (approximation from record_count)
  const growthSpark = recentRuns;

  // ── Synergy (CRM) ──────────────────────────────────────────────────────────
  const inquiries = inquiriesRes.data ?? [];
  const inqTotal  = inquiries.length;

  const inqByStatus: Record<string, number> = {};
  for (const q of inquiries) {
    const s = q.status ?? 'unknown';
    inqByStatus[s] = (inqByStatus[s] ?? 0) + 1;
  }
  const inqActive     = inquiries.filter(q => !TERMINAL.includes(q.status)).length;
  const inqHot        = (inqByStatus.viewing ?? 0) + (inqByStatus.negotiating ?? 0);
  const inqWon        = inqByStatus.won  ?? 0;
  const inqLost       = inqByStatus.lost ?? 0;
  const decided       = inqWon + inqLost;
  const conversion    = decided > 0 ? Math.round((inqWon / decided) * 100) : null;
  const totalMatches  = inquiries.reduce((s, q) => s + (q.match_count ?? 0), 0);
  const avgMatches    = inqTotal > 0 ? +(totalMatches / inqTotal).toFixed(1) : 0;

  const sourceBars = countBy(inquiries, 'source').slice(0, 6);

  const STAGES = ['new', 'contacted', 'viewing', 'negotiating', 'won', 'lost', 'cancelled', 'closed'];
  const funnelBars = STAGES.map(s => ({ label: s, v: inqByStatus[s] ?? 0 }));

  // Budget range breakdown
  const budgetBars = [
    { label: '< 5k',   v: inquiries.filter(q => (q.budget_max ?? 0) < 5000).length },
    { label: '5–8k',   v: inquiries.filter(q => (q.budget_min ?? 0) >= 5000 && (q.budget_max ?? 0) <= 8000).length },
    { label: '8–12k',  v: inquiries.filter(q => (q.budget_min ?? 0) > 8000 && (q.budget_max ?? 0) <= 12000).length },
    { label: '12–20k', v: inquiries.filter(q => (q.budget_min ?? 0) > 12000 && (q.budget_max ?? 0) <= 20000).length },
    { label: '> 20k',  v: inquiries.filter(q => (q.budget_min ?? 0) > 20000).length },
  ];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),

    operational: {
      total: totalUnits, available, leased, reserved, maintenance, lookupQueue,
      typeBreakdown, zoneBreakdown, configBreakdown, furnishBreakdown,
    },

    ingestion: {
      totalRuns, totalIngested, stNew, stUpdated, stUnchanged, schemaErrors,
      recentRuns,
    },

    governance: {
      smartCodesIssued: Math.max(smartCodesIssued, totalUnits),
      nullSmartCodes,
      masterCodes: Math.max(masterCodes, totalRuns),
      aliasCodesMapped: uniqueProperties,
    },

    financial: {
      avgRent, portfolioMonthlyRent, monthFreeCount,
      avgDeposit, avgKahramaa,
      rentBars,
    },

    registry: {
      registeredAgents, activeZones, entityCodes, zonesWithUnits,
      zoneTopBars,
    },

    executive: {
      occupancyPct, availRate, portfolioMonthlyRent, totalRuns,
      growthSpark,
    },

    synergy: {
      total: inqTotal, active: inqActive, hot: inqHot,
      won: inqWon, lost: inqLost, conversion, avgMatches,
      funnelBars, sourceBars, budgetBars,
    },
  });
}
