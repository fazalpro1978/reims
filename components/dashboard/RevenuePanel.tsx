'use client';

import { useState, useEffect } from 'react';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';

interface RevenueData {
  leased:    number;
  available: number;
  reserved:  number;
  total:     number;
}

function fmtQAR(n: number): string {
  if (n >= 1_000_000) return `QAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `QAR ${(n / 1_000).toFixed(0)}K`;
  return `QAR ${n.toLocaleString()}`;
}

interface CardProps {
  label:  string;
  value:  number | null;
  sub:    string;
  accent: string;
}

function RevenueCard({ label, value, sub, accent }: CardProps) {
  return (
    <div style={{
      background: '#0d0d14',
      border: '1px solid #1e1e2e',
      borderTop: `2px solid ${accent}`,
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#44445a' }}>
        {label}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#e2e2ee', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value === null ? '—' : fmtQAR(value)}
      </p>
      <p style={{ margin: 0, fontSize: 10, color: '#44445a' }}>{sub}</p>
    </div>
  );
}

export default function RevenuePanel() {
  const { user, role } = useAuth();
  const [data,    setData   ] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'superuser' || role === 'administrator';

  useEffect(() => {
    if (!user || !isAdmin) { setLoading(false); return; }
    authedFetch('/api/dashboard/revenue')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error) setData(j); })
      .finally(() => setLoading(false));
  }, [user, isAdmin]);

  if (!isAdmin) return null;

  const occupancyPct = data && data.total > 0
    ? Math.round((data.leased / data.total) * 100)
    : null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={headingStyle}>Revenue</h3>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#c9a84c', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', padding: '2px 6px', borderRadius: 4 }}>
          ADMIN
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 70, borderRadius: 10, background: '#1a1a24' }} />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RevenueCard
              label="Active Revenue"
              value={data?.leased ?? null}
              sub={occupancyPct !== null ? `${occupancyPct}% of portfolio by value` : 'Leased units · annual'}
              accent="#2dd496"
            />
            <RevenueCard
              label="Pipeline Value"
              value={data?.available ?? null}
              sub="Available units · potential annual"
              accent="#5b9cf6"
            />
            <RevenueCard
              label="Reserved"
              value={data?.reserved ?? null}
              sub="Reserved units · pending conversion"
              accent="#a47cf5"
            />
          </div>

          {data && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#0a0a10', borderRadius: 8, border: '1px solid #1a1a24' }}>
              <p style={{ margin: 0, fontSize: 9.5, color: '#44445a' }}>Total portfolio value</p>
              <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#c9a84c', fontVariantNumeric: 'tabular-nums' }}>
                {fmtQAR(data.total)}
                <span style={{ fontSize: 10, fontWeight: 400, color: '#44445a', marginLeft: 6 }}>/ year</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #22222e',
  borderRadius: 12,
  padding: '20px',
};

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#44445a',
  margin: 0,
};
