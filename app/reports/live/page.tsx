'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

/* ── Types ─────────────────────────────────────────────────────────── */
interface Bar { label: string; v: number }

interface LiveData {
  generatedAt: string;
  operational: {
    total: number; available: number; leased: number;
    reserved: number; maintenance: number; lookupQueue: number;
    typeBreakdown: Bar[]; zoneBreakdown: Bar[];
    configBreakdown: Bar[]; furnishBreakdown: Bar[];
  };
  ingestion: {
    totalRuns: number; totalIngested: number; stNew: number;
    stUpdated: number; stUnchanged: number; schemaErrors: number;
    recentRuns: Bar[];
  };
  governance: {
    smartCodesIssued: number; nullSmartCodes: number;
    masterCodes: number; aliasCodesMapped: number;
  };
  financial: {
    avgRent: number; portfolioMonthlyRent: number;
    monthFreeCount: number; avgDeposit: number; avgKahramaa: number;
    rentBars: Bar[];
  };
  registry: {
    registeredAgents: number; activeZones: number;
    entityCodes: number; zonesWithUnits: number;
    zoneTopBars: Bar[];
  };
  executive: {
    occupancyPct: number; availRate: number;
    portfolioMonthlyRent: number; totalRuns: number;
    growthSpark: Bar[];
  };
  synergy: {
    total: number; active: number; hot: number;
    won: number; lost: number; conversion: number | null; avgMatches: number;
    funnelBars: Bar[]; sourceBars: Bar[]; budgetBars: Bar[];
  };
}

/* ── Palette ───────────────────────────────────────────────────────── */
const C = {
  bg:     '#08080b',
  surf:   '#0f0f15',
  surf2:  '#141420',
  border: '#1e1e2e',
  bord2:  '#2a2a3e',
  text:   '#e2e2ee',
  text2:  '#9898b8',
  muted:  '#44445a',
  gold:   '#c9a84c',
  gold2:  '#e8c86a',
  c1: '#c9a84c', c2: '#5b9cf6', c3: '#a47cf5',
  c4: '#2dd496', c5: '#f5a847', c6: '#e8445a', c7: '#38bdf8',
};

/* ── Helpers ───────────────────────────────────────────────────────── */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return n.toLocaleString();
  return String(n);
}

function BarChart({ bars, color = C.gold, label = '' }: { bars: Bar[]; color?: string; label?: string }) {
  const max = Math.max(...bars.map(b => b.v), 1);
  return (
    <div>
      {label && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>{label}</div>}
      {bars.map((b, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 48px', alignItems: 'center', gap: 10, padding: '5px 0' }}>
          <div style={{ fontSize: 11, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
          <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: color, width: `${Math.round((b.v / max) * 100)}%`, transition: 'width .5s ease' }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: "'IBM Plex Mono', monospace" }}>{b.v}</div>
        </div>
      ))}
    </div>
  );
}

function KPI({ label, val, sub, subClass, accent = C.gold }: { label: string; val: string | number; sub?: string; subClass?: 'up' | 'down'; accent?: string }) {
  const subColor = subClass === 'up' ? '#2dd496' : subClass === 'down' ? '#e8445a' : C.muted;
  return (
    <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: `2px solid ${accent}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: subColor }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function SparkBar({ bars, color = C.gold }: { bars: Bar[]; color?: string }) {
  const max = Math.max(...bars.map(b => b.v), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, color: C.muted, width: 36, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{b.label}</div>
          <div style={{ flex: 1, height: 20, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((b.v / max) * 100)}%`, background: color, borderRadius: 2, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{b.v}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Section headers ────────────────────────────────────────────────── */
const TABS = [
  { id: 0, label: '01 · Operational', color: C.c1 },
  { id: 1, label: '02 · Ingestion',   color: C.c2 },
  { id: 2, label: '03 · Governance',  color: C.c3 },
  { id: 3, label: '04 · Financial',   color: C.c4 },
  { id: 4, label: '05 · Registry',    color: C.c5 },
  { id: 5, label: '06 · Executive',   color: C.c6 },
  { id: 6, label: '07 · Synergy',     color: C.c7 },
];

/* ── Main component ─────────────────────────────────────────────────── */
export default function LiveReportPage() {
  const [data,       setData]      = useState<LiveData | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState<string | null>(null);
  const [activeTab,  setActiveTab] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please log in again.');
      const res = await fetch('/api/reports/live-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? 'Failed to load live data');
      }
      const json = await res.json() as LiveData;
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tab = TABS[activeTab];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Topbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(8,8,11,.95)', borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 700, color: C.gold, letterSpacing: '.02em' }}>Vanguard REOS</span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: C.muted }}>Live Portfolio Intelligence</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.muted }}>
            {lastRefresh ? lastRefresh.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
          <span style={{ background: '#2dd49622', border: '1px solid #2dd49644', color: '#2dd496', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20 }}>● LIVE</span>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', border: `1px solid ${C.bord2}`, background: 'transparent', color: loading ? C.muted : C.text2, transition: 'all .12s' }}
          >
            {loading ? 'Loading…' : '↺ Refresh'}
          </button>
          <button
            onClick={() => window.history.back()}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', border: `1px solid ${C.bord2}`, background: 'transparent', color: C.muted, transition: 'all .12s' }}
          >
            ← Back
          </button>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <nav style={{ display: 'flex', gap: 0, overflowX: 'auto', background: C.surf, borderBottom: `1px solid ${C.border}`, padding: '0 28px', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600,
              letterSpacing: '.08em', textTransform: 'uppercase',
              color: activeTab === t.id ? C.text : C.muted,
              padding: '14px 16px', whiteSpace: 'nowrap',
              borderBottom: `2px solid ${activeTab === t.id ? C.gold : 'transparent'}`,
              transition: 'color .15s, border-color .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main style={{ padding: '28px', maxWidth: 1400, margin: '0 auto' }}>

        {error && (
          <div style={{ padding: '20px', background: '#e8445a18', border: `1px solid #e8445a44`, borderRadius: 10, color: '#e8445a', marginBottom: 24 }}>
            ⚠ {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
            Loading live portfolio data…
          </div>
        )}

        {data && (
          <>
            {/* ── Tab 0: Operational ── */}
            {activeTab === 0 && (
              <div>
                <SectionHeader title="Operational & Inventory" meta={`${data.operational.total.toLocaleString()} units across portfolio`} color={C.c1} badge="LIVE" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Total Units"    val={data.operational.total}        sub="Across portfolio"              accent={C.gold} />
                  <KPI label="Available"      val={data.operational.available}    sub={`▲ ${data.executive.availRate}% of portfolio`} subClass="up" accent={C.c4} />
                  <KPI label="Leased"         val={data.operational.leased}       sub="Active contracts"              accent={C.c2} />
                  <KPI label="Reserved"       val={data.operational.reserved}     sub="In pipeline"                   accent={C.c3} />
                  <KPI label="Maintenance"    val={data.operational.maintenance}  sub="Under preparation"             accent={C.c6} />
                  <KPI label="Look-Up Queue"  val={data.operational.lookupQueue}  sub="Needs review" subClass={data.operational.lookupQueue > 0 ? 'down' : undefined} accent={C.c5} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <Card title="Units by Type">
                    <BarChart bars={data.operational.typeBreakdown.slice(0,8)} color={C.c1} />
                  </Card>
                  <Card title="Units by Zone">
                    <BarChart bars={data.operational.zoneBreakdown.slice(0,8)} color={C.c2} />
                  </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Card title="Units by Furnishing">
                    <BarChart bars={data.operational.furnishBreakdown} color={C.c3} />
                  </Card>
                  <Card title="Units by Config">
                    <BarChart bars={data.operational.configBreakdown.slice(0,8)} color={C.c4} />
                  </Card>
                </div>
              </div>
            )}

            {/* ── Tab 1: Ingestion ── */}
            {activeTab === 1 && (
              <div>
                <SectionHeader title="Ingestion & Validation" meta={`${data.ingestion.totalRuns} import runs · ${data.ingestion.totalIngested.toLocaleString()} records`} color={C.c2} badge="AXIOM" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Total Runs"     val={data.ingestion.totalRuns}      sub="All-time batches"              accent={C.c2} />
                  <KPI label="Total Ingested" val={data.ingestion.totalIngested}  sub="Across all runs" subClass="up" accent={C.c4} />
                  <KPI label="ST_NEW"         val={data.ingestion.stNew}          sub="● New / approved"              accent={C.c5} />
                  <KPI label="ST_UPDATED"     val={data.ingestion.stUpdated}      sub="● Updated"                     accent={C.c4} />
                  <KPI label="ST_UNCHANGED"   val={data.ingestion.stUnchanged}    sub="● Stale / skipped"             accent={C.gold} />
                  <KPI label="Schema Errors"  val={data.ingestion.schemaErrors}   sub={data.ingestion.schemaErrors > 0 ? '▼ Failed runs' : '✓ Clean'} subClass={data.ingestion.schemaErrors > 0 ? 'down' : 'up'} accent={C.c6} />
                </div>
                <Card title="Records per Run (Recent)">
                  <SparkBar bars={data.ingestion.recentRuns} color={C.c2} />
                </Card>
              </div>
            )}

            {/* ── Tab 2: Governance ── */}
            {activeTab === 2 && (
              <div>
                <SectionHeader title="Identifier & Governance" meta="Smart code registry status" color={C.c3} badge="CODE REG" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Smart Codes Issued"  val={data.governance.smartCodesIssued} sub="14-char identifiers"       accent={C.c3} />
                  <KPI label="Master Codes Active" val={data.governance.masterCodes}       sub="DDMMHHMM stamped"         accent={C.c3} />
                  <KPI label="Alias Codes Mapped"  val={data.governance.aliasCodesMapped}  sub="Cross-reference anchors"  accent={C.c5} />
                  <KPI label="Null Smart Codes"    val={data.governance.nullSmartCodes}     sub={data.governance.nullSmartCodes === 0 ? '✓ Clean' : '▼ Action needed'} subClass={data.governance.nullSmartCodes === 0 ? 'up' : 'down'} accent={C.c6} />
                </div>
                <Card title="Code Health">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Smart codes 100% coverage', ok: data.governance.nullSmartCodes === 0 },
                      { label: 'Master codes active', ok: data.governance.masterCodes > 0 },
                      { label: 'Alias index built', ok: data.governance.aliasCodesMapped > 0 },
                      { label: 'No null identifiers', ok: data.governance.nullSmartCodes === 0 },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: C.surf2, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.ok ? '#2dd496' : '#e8445a', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: C.text2 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Tab 3: Financial ── */}
            {activeTab === 3 && (
              <div>
                <SectionHeader title="Financial & Utility Summary" meta="Live rent and utility aggregates from units table" color={C.c4} badge="FINANCE" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Avg Monthly Rent"     val={`${fmt(data.financial.avgRent)} QAR`}              sub="Per unit average"            accent={C.c4} />
                  <KPI label="Portfolio Rent (Mo)"  val={`${fmt(data.financial.portfolioMonthlyRent)} QAR`} sub="Potential monthly" subClass="up" accent={C.c4} />
                  <KPI label="Units w/ Month Free"  val={data.financial.monthFreeCount}                     sub="month_free_applicable"       accent={C.c5} />
                  <KPI label="Avg Security Deposit" val={`${fmt(data.financial.avgDeposit)} QAR`}           sub="Average deposit"             accent={C.c3} />
                  <KPI label="Avg Kahramaa"         val={data.financial.avgKahramaa > 0 ? `${fmt(data.financial.avgKahramaa)} QAR` : '—'} sub="Where applicable" accent={C.c2} />
                </div>
                <Card title="Average Rent by Property">
                  <BarChart bars={data.financial.rentBars} color={C.c4} />
                </Card>
              </div>
            )}

            {/* ── Tab 4: Registry ── */}
            {activeTab === 4 && (
              <div>
                <SectionHeader title="Registry & Entity Mapping" meta="CR table snapshot" color={C.c5} badge="REGISTRY" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Registered Agents" val={data.registry.registeredAgents}  sub="cr_agents table"   accent={C.c5} />
                  <KPI label="Active Zones"       val={data.registry.activeZones}       sub="cr_zone_codes"     accent={C.c5} />
                  <KPI label="Entity Codes"       val={data.registry.entityCodes}       sub="Unique prefixes"   accent={C.c2} />
                  <KPI label="Zones with Units"   val={data.registry.zonesWithUnits}    sub={`${data.registry.activeZones > 0 ? Math.round((data.registry.zonesWithUnits/data.registry.activeZones)*100) : 0}% utilisation`} subClass="up" accent={C.c4} />
                </div>
                <Card title="Top Zones by Unit Count">
                  <BarChart bars={data.registry.zoneTopBars} color={C.c5} />
                </Card>
              </div>
            )}

            {/* ── Tab 5: Executive ── */}
            {activeTab === 5 && (
              <div>
                <SectionHeader title="Executive & Portfolio Summary" meta="C-suite snapshot" color={C.c6} badge="EXEC" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Portfolio Occupancy"  val={`${data.executive.occupancyPct}%`}                        sub="Reserved + Leased + Maint" subClass={data.executive.occupancyPct > 0 ? 'up' : undefined} accent={C.c6} />
                  <KPI label="Availability Rate"    val={`${data.executive.availRate}%`}                           sub="▲ Strong" subClass="up"     accent={C.c4} />
                  <KPI label="Potential Revenue"    val={`QAR ${fmt(data.executive.portfolioMonthlyRent)}`}        sub="Monthly if 100% leased"    accent={C.c1} />
                  <KPI label="Import Runs"          val={data.executive.totalRuns}                                  sub="All-time batches"          accent={C.c2} />
                </div>
                <Card title="Import Volume (Recent Runs)">
                  <SparkBar bars={data.executive.growthSpark} color={C.c6} />
                </Card>
              </div>
            )}

            {/* ── Tab 6: Synergy ── */}
            {activeTab === 6 && (
              <div>
                <SectionHeader title="Synergy — CRM & Pipeline" meta="Inquiry and deal-flow intelligence" color={C.c7} badge="CRM" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                  <KPI label="Total Inquiries"  val={data.synergy.total}       sub="All-time"                  accent={C.c7} />
                  <KPI label="Active Pipeline"  val={data.synergy.active}      sub="Non-terminal"              accent={C.c2} />
                  <KPI label="Hot (View+Neg)"   val={data.synergy.hot}         sub="Viewing & Negotiating"     accent={C.c5} />
                  <KPI label="Won"              val={data.synergy.won}         sub="Closed deals"              accent={C.c4} />
                  <KPI label="Conversion"       val={data.synergy.conversion !== null ? `${data.synergy.conversion}%` : '—%'} sub="Won ÷ (Won + Lost)" accent={data.synergy.conversion !== null ? C.c4 : C.c6} />
                  <KPI label="Avg Matches"      val={data.synergy.avgMatches}  sub="Per inquiry"               accent={C.c3} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <Card title="Pipeline Funnel">
                    <BarChart bars={data.synergy.funnelBars.filter(b => b.v > 0)} color={C.c7} />
                  </Card>
                  <Card title="Source Breakdown">
                    <BarChart bars={data.synergy.sourceBars} color={C.c2} />
                  </Card>
                  <Card title="Budget Range (QAR/mo)">
                    <BarChart bars={data.synergy.budgetBars} color={C.c5} />
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SectionHeader({ title, meta, color, badge }: { title: string; meta: string; color: string; badge: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: C.text }}>{title}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{meta}</div>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, border: `1px solid ${color}44`, color, marginTop: 4, flexShrink: 0 }}>
        {badge}
      </div>
    </div>
  );
}
