'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface SynergyData {
  total:      number;
  active:     number;
  hot:        number;
  won:        number;
  lost:       number;
  conversion: number | null;
  avgMatches: number;
  new7d:      number;
  new30d:     number;
  byStatus:   Record<string, number>;
}

const PIPELINE_STAGES = [
  { key: 'new',          label: 'New',          color: '#94a3b8' },
  { key: 'contacted',    label: 'Contacted',    color: '#38bdf8' },
  { key: 'viewing',      label: 'Viewing',      color: '#fbbf24' },
  { key: 'negotiating',  label: 'Negotiating',  color: '#fb923c' },
  { key: 'won',          label: 'Won',          color: '#4ade80' },
  { key: 'lost',         label: 'Lost',         color: '#f87171' },
];

function StatTile({
  label, value, sub, accent, onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#0e0e14',
        border: `1px solid #22222e`,
        borderTop: `2px solid ${accent}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = accent)}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = '#22222e')}
    >
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#44445a' }}>
        {label}
      </span>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#e2e2ee', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: '#44445a' }}>{sub}</span>
      )}
    </div>
  );
}

export default function SynergyStats() {
  const { user } = useAuth();
  const router   = useRouter();
  const [data,    setData   ] = useState<SynergyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/synergy')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error) setData(j); })
      .finally(() => setLoading(false));
  }, [user]);

  const maxStage = data
    ? Math.max(...PIPELINE_STAGES.map(s => data.byStatus[s.key] ?? 0), 1)
    : 1;

  return (
    <div style={{
      background: '#111118',
      border: '1px solid #22222e',
      borderRadius: 12,
      padding: '20px',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#44445a', margin: 0 }}>
          Synergy — Pipeline Overview
        </h3>
        <button
          onClick={() => router.push('/synergy')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5b9cf6', padding: 0 }}
        >
          Open Synergy →
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height: 76, borderRadius: 10, background: '#1a1a24' }} />
          ))}
        </div>
      ) : !data ? (
        <p style={{ fontSize: 12, color: '#44445a', margin: 0 }}>No synergy data.</p>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
            <StatTile
              label="Total Inquiries"
              value={data.total}
              sub={`${data.new30d} in last 30d`}
              accent="#c9a84c"
              onClick={() => router.push('/synergy')}
            />
            <StatTile
              label="Active Pipeline"
              value={data.active}
              sub={`${data.total > 0 ? Math.round((data.active / data.total) * 100) : 0}% of total`}
              accent="#5b9cf6"
              onClick={() => router.push('/synergy?status=new')}
            />
            <StatTile
              label="Hot (View + Neg.)"
              value={data.hot}
              sub="Viewing & Negotiating"
              accent="#fb923c"
              onClick={() => router.push('/synergy?status=viewing')}
            />
            <StatTile
              label="Won"
              value={data.won}
              sub={data.lost > 0 ? `vs ${data.lost} lost` : 'Closed deals'}
              accent="#4ade80"
              onClick={() => router.push('/synergy?status=won')}
            />
            <StatTile
              label="Conversion"
              value={data.conversion !== null ? `${data.conversion}%` : '—'}
              sub="Won ÷ (Won + Lost)"
              accent={data.conversion !== null && data.conversion >= 50 ? '#4ade80' : '#f87171'}
            />
            <StatTile
              label="Avg. Matches"
              value={data.avgMatches}
              sub="Per inquiry"
              accent="#a47cf5"
            />
          </div>

          {/* Stage funnel bars */}
          <div style={{ height: 1, background: '#1e1e2e', margin: '0 0 14px' }} />
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#44445a', margin: '0 0 10px' }}>
            Stage Breakdown
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {PIPELINE_STAGES.map(({ key, label, color }) => {
              const count = data.byStatus[key] ?? 0;
              const pct   = Math.round((count / maxStage) * 100);
              return (
                <div
                  key={key}
                  onClick={() => router.push(`/synergy?status=${key}`)}
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#7878a8' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? '#e2e2ee' : '#2e2e3e', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </span>
                  </div>
                  <div style={{ height: 3, background: '#1e1e2e', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* New this week callout */}
          {data.new7d > 0 && (
            <p style={{ marginTop: 14, marginBottom: 0, fontSize: 10, color: '#44445a' }}>
              <span style={{ color: '#5b9cf6', fontWeight: 700 }}>{data.new7d}</span> new {data.new7d === 1 ? 'inquiry' : 'inquiries'} in the last 7 days
            </p>
          )}
        </>
      )}
    </div>
  );
}
