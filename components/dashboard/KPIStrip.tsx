'use client';

import { useState, useEffect } from 'react';
import { authedFetch } from '../../lib/authedFetch';
import { useAuth } from '../../contexts/AuthContext';
import { KPIStripSkeleton } from './PanelSkeleton';

interface KPIData {
  total:       number;
  available:   number;
  leased:      number;
  reserved:    number;
  maintenance: number;
}

interface CardProps {
  label:    string;
  value:    number | null;
  delta:    string;
  deltaUp?: boolean | null; // true=green, false=red, null=neutral
  accent:   string;
}

function KPICard({ label, value, delta, deltaUp, accent }: CardProps) {
  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid #22222e',
        borderTop: `2px solid ${accent}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: '#44445a',
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#e2e2ee',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value === null ? '—' : value.toLocaleString()}
      </span>

      <span
        style={{
          fontSize: 10,
          color: deltaUp === true ? '#2dd496' : deltaUp === false ? '#e8445a' : '#44445a',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        {deltaUp === true && '▲ '}{deltaUp === false && '▼ '}{delta}
      </span>
    </div>
  );
}

export default function KPIStrip() {
  const { user } = useAuth();
  const [data,    setData   ] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    authedFetch('/api/dashboard/kpis')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && !j.error) setData(j); })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <KPIStripSkeleton />;

  const availPct  = data && data.total > 0 ? Math.round((data.available / data.total) * 100)  : null;
  const leasedPct = data && data.total > 0 ? Math.round((data.leased    / data.total) * 100)  : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}
    >
      <KPICard
        label="Total Units"
        value={data?.total ?? null}
        delta={data ? `Across the portfolio` : 'Loading…'}
        deltaUp={null}
        accent="#c9a84c"
      />
      <KPICard
        label="Available"
        value={data?.available ?? null}
        delta={availPct !== null ? `${availPct}% of portfolio` : '—'}
        deltaUp={availPct !== null ? availPct >= 30 : null}
        accent="#2dd496"
      />
      <KPICard
        label="Leased"
        value={data?.leased ?? null}
        delta={leasedPct !== null ? `${leasedPct}% occupancy` : '—'}
        deltaUp={leasedPct !== null ? leasedPct >= 60 : null}
        accent="#5b9cf6"
      />
      <KPICard
        label="Reserved"
        value={data?.reserved ?? null}
        delta={data?.maintenance ? `+${data.maintenance} in maintenance` : 'In pipeline'}
        deltaUp={null}
        accent="#a47cf5"
      />
    </div>
  );
}
